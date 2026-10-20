import { useEffect } from "react";
import { isTextColumn } from "../../../../shared/table-columns";
import { annotatePage, annotateTableActions, installActionMenus } from "./dashboardEnhancers";

const ACTION_COLUMN = /^actions?$|edit\s*\/\s*view|manage/i;
const STATUS_COLUMN = /status|state/i;
const SELECT_COLUMN = /select|checkbox/i;
const INDEX_COLUMN = /^(no\.?|#|s\.?\s*no\.?)$/i;
const SHORT_COLUMN = /date|time|amount|price|total|count|qty|quantity|id|code|reference/i;

function columnKind(label: string, index: number, cell?: HTMLTableCellElement) {
  if (cell?.querySelector('input[type="checkbox"]') || SELECT_COLUMN.test(label)) return "select";
  if (ACTION_COLUMN.test(label)) return "action";
  if (STATUS_COLUMN.test(label)) return "status";
  if (INDEX_COLUMN.test(label)) return "index";
  if (isTextColumn({ key: label || String(index), header: label }, index)) return "primary";
  if (SHORT_COLUMN.test(label)) return "short";
  return "default";
}

function annotateTable(table: HTMLTableElement) {
  const headingRow = table.tHead?.rows.item(table.tHead.rows.length - 1);
  const headings = headingRow
    ? Array.from(headingRow.cells).map((cell) => cell.textContent?.trim() || "")
    : [];

  table.classList.add("tv-data-table");
  table.dataset.tvAnnotated = "true";

  const nearbyHeading = table
    .closest("section, article, main, div")
    ?.querySelector<HTMLElement>("h1, h2, h3");
  if (!table.getAttribute("aria-label") && nearbyHeading?.textContent?.trim()) {
    table.setAttribute("aria-label", nearbyHeading.textContent.trim());
  }

  if (headingRow) {
    Array.from(headingRow.cells).forEach((cell, index) => {
      const kind = columnKind(headings[index] || "", index, cell);
      if (kind !== "default") cell.dataset.tvColumn = kind;
      cell.setAttribute("scope", "col");
    });
  }

  Array.from(table.tBodies).forEach((body) => {
    Array.from(body.rows).forEach((row) => {
      Array.from(row.cells).forEach((cell, index) => {
        if (cell.colSpan > 1) return;
        const label = headings[index] || "";
        const kind = columnKind(label, index, cell);
        if (label) cell.dataset.label = label;
        if (kind !== "default") cell.dataset.tvColumn = kind;
        if (kind === "primary") {
          cell.dataset.primary = "true";
          cell.classList.add("tv-align-left");
        }
      });
    });
  });

  const scrollContainer = table.parentElement;
  if (
    scrollContainer?.classList.contains("overflow-x-auto") ||
    scrollContainer?.classList.contains("overflow-auto")
  ) {
    scrollContainer.classList.add("tv-table-scroll");
  }
}

function annotateDashboard(root: HTMLElement) {
  root.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    annotateTable(table);
    annotateTableActions(table);
  });
  annotatePage(root);
}

const CLOSE_LABEL = /^(close|cancel|×|✕|x)$/i;

/** The control that dismisses a drawer: header ✕ first, then a Close / Cancel button. */
function findCloseControl(overlay: HTMLElement): HTMLElement | null {
  const buttons = Array.from(overlay.querySelectorAll<HTMLElement>("button"));
  const byLabel = buttons.find((b) => /^(close|cancel)\b/i.test(b.getAttribute("aria-label") || ""));
  if (byLabel) return byLabel;
  const byIcon = buttons.find(
    (b) => b.querySelector(".material-symbols-rounded")?.textContent?.trim() === "close",
  );
  if (byIcon) return byIcon;
  return buttons.find((b) => CLOSE_LABEL.test((b.textContent || "").trim())) ?? null;
}

/** Clicking the dimmed area beside a right-side drawer closes it, whichever page opened it. */
function installDrawerBackdropClose() {
  let downTarget: EventTarget | null = null;
  const isDrawerBackdrop = (el: EventTarget | null): el is HTMLElement =>
    el instanceof HTMLElement &&
    el.closest(".dashboard-shell") !== null &&
    el.matches(".tv-drawer-overlay, .fixed.inset-0") &&
    !el.matches(".lg\\:hidden, .md\\:hidden, .sm\\:hidden") &&
    !/bg-black\/(8|9)/.test(el.className);

  const onDown = (event: MouseEvent) => {
    downTarget = event.target;
  };
  const onClick = (event: MouseEvent) => {
    const overlay = event.target;
    // Only a press that both started and ended on the backdrop (not a text-selection drag from the panel).
    if (!isDrawerBackdrop(overlay) || downTarget !== overlay) return;
    window.setTimeout(() => {
      // Pages that already close on backdrop click have unmounted it by now.
      if (!overlay.isConnected) return;
      findCloseControl(overlay)?.click();
    }, 0);
  };

  document.addEventListener("mousedown", onDown, true);
  document.addEventListener("click", onClick, true);
  return () => {
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("click", onClick, true);
  };
}

/** Adds the shared table contract to legacy role pages without touching their data or handlers. */
export default function SharedUiRuntime() {
  useEffect(() => installDrawerBackdropClose(), []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".dashboard-typography main");
    if (!root) return;

    let frame = 0;
    const schedule = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => annotateDashboard(root));
    };

    schedule();
    const removeMenus = installActionMenus();
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true });

    return () => {
      removeMenus();
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

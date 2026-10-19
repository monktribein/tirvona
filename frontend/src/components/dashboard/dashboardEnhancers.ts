/**
 * Runtime enhancers for the shared dashboard shell.
 *
 *  - Table action cells: icon buttons become named actions. Two or more actions
 *    collapse into one "Actions" dropdown; a lone action shows its name instead
 *    of an icon. Only attributes/classes are added, so React handlers, state
 *    and keys of the original buttons are untouched.
 *  - Page structure: the page title/header is marked so the stylesheet can place
 *    it first, above summary cards.
 */

const ACTION_HEADER = /action|edit|view|manage|operation|option/i;
const DANGER = /delet|remov|reject|cancel|suspend|block|revoke|disable|deactivat|ban\b|terminat|decline/i;
const CONTROL_SELECTOR = 'button, a[href], [role="button"]';

const ICON_LABELS: Record<string, string> = {
  visibility: "View",
  visibility_off: "Unpublish",
  edit: "Edit",
  edit_square: "Edit",
  delete: "Delete",
  delete_forever: "Delete",
  public: "Publish",
  check: "Approve",
  check_circle: "Approve",
  done: "Approve",
  close: "Reject",
  cancel: "Cancel",
  block: "Block",
  download: "Download",
  upload: "Upload",
  content_copy: "Copy",
  qr_code: "QR code",
  qr_code_2: "QR code",
  refresh: "Refresh",
  lock: "Lock",
  lock_open: "Unlock",
  open_in_new: "Open",
  print: "Print",
  send: "Send",
  history: "History",
  payments: "Payments",
  receipt_long: "Receipt",
  person: "Profile",
  key: "Manage access",
  settings: "Settings",
  more_vert: "More",
};

const humanize = (value: string) =>
  value
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();

/** Text a control shows besides its icon glyph. */
function visibleText(control: HTMLElement): string {
  const clone = control.cloneNode(true) as HTMLElement;
  clone
    .querySelectorAll(".material-symbols-rounded, svg")
    .forEach((icon) => icon.remove());
  return (clone.textContent || "").replace(/\s+/g, " ").trim();
}

function labelOf(control: HTMLElement): string {
  const text = visibleText(control);
  if (text) return text;
  const own = (
    control.getAttribute("aria-label") ||
    control.getAttribute("title") ||
    ""
  ).trim();
  if (own) return own;
  const glyph =
    control.querySelector(".material-symbols-rounded")?.textContent?.trim() || "";
  return ICON_LABELS[glyph] ?? (glyph ? humanize(glyph) : "Action");
}

function commonAncestor(nodes: HTMLElement[], stop: HTMLElement): HTMLElement {
  let node: HTMLElement | null = nodes[0].parentElement;
  while (node && node !== stop) {
    const current = node;
    if (nodes.every((n) => current.contains(n))) return current;
    node = node.parentElement;
  }
  return stop;
}

function annotateActionCell(cell: HTMLTableCellElement, header: string, isLast: boolean) {
  const controls = Array.from(
    cell.querySelectorAll<HTMLElement>(CONTROL_SELECTOR),
  ).filter(
    (control) =>
      !(control instanceof HTMLInputElement) &&
      !control.closest('[role="menu"], [role="listbox"]'),
  );
  if (!controls.length) return;

  const controlText = controls.map(visibleText).join("");
  const cellText = (cell.textContent || "").replace(/\s+/g, "");
  const ownText = cellText.replace(controlText.replace(/\s+/g, ""), "");
  const iconOnly = controls.every((control) => !visibleText(control));
  const isActionCell =
    ACTION_HEADER.test(header) ||
    (isLast && (iconOnly || (controls.length > 1 && !ownText.replace(/[^\p{L}\p{N}]/gu, ""))));
  if (!isActionCell) return;

  controls.forEach((control) => {
    const label = labelOf(control);
    control.classList.add("tv-act");
    control.dataset.tvLabel = label;
    if (!visibleText(control)) control.dataset.tvIconOnly = "true";
    if (DANGER.test(label)) control.dataset.tvDanger = "true";
  });

  if (controls.length < 2) {
    cell.dataset.tvActions = "inline";
    return;
  }

  const host = commonAncestor(controls, cell);
  if (host === cell) {
    cell.dataset.tvActions = "inline";
    return;
  }
  cell.dataset.tvActions = "menu";
  host.classList.add("tv-menu");
  host.setAttribute("role", "button");
  host.setAttribute("aria-haspopup", "menu");
  host.setAttribute("tabindex", "0");
}

export function annotateTableActions(table: HTMLTableElement) {
  const headRow = table.tHead?.rows.item(table.tHead.rows.length - 1);
  const headers = headRow
    ? Array.from(headRow.cells).map((cell) => cell.textContent?.trim() || "")
    : [];
  Array.from(table.tBodies).forEach((body) => {
    Array.from(body.rows).forEach((row) => {
      const cells = Array.from(row.cells);
      cells.forEach((cell, index) => {
        if (cell.colSpan > 1) return;
        annotateActionCell(cell, headers[index] || "", index === cells.length - 1 && cells.length > 1);
      });
    });
  });
}

/** Marks the page header so CSS can put it above summary cards. */
export function annotatePage(main: HTMLElement) {
  const surface = main.querySelector<HTMLElement>(".tv-dashboard-page-surface");
  if (!surface) return;
  const blocks = Array.from(surface.children).filter(
    (child) => !child.classList.contains("tv-summary-strip"),
  ) as HTMLElement[];
  const pageRoot = blocks.length === 1 ? blocks[0] : null;
  const container = pageRoot ?? surface;

  const candidates = (Array.from(container.children) as HTMLElement[])
    .filter((child) => !child.classList.contains("tv-summary-strip"))
    .slice(0, 5);
  const header = candidates.find(
    (child) =>
      child.classList.contains("tv-page-header") ||
      (!child.querySelector("table, form") &&
        child.querySelector("h1, h2") !== null &&
        !child.matches('[class*="grid-cols"]')),
  );
  if (!header) return;
  header.dataset.tvHeader = "true";

  if (
    pageRoot &&
    !pageRoot.hasAttribute("data-tv-page-root") &&
    !/(^|\s)(bg-|border|p-\d|px-|py-|pt-|pb-|shadow|rounded|max-w-|mx-auto|grid)/.test(
      pageRoot.className,
    )
  ) {
    pageRoot.dataset.tvPageRoot = "true";
  }
}

/* ---------------------------------------------------------------- *
 * Dropdown behaviour (delegated, installed once)
 * ---------------------------------------------------------------- */
let installed = false;

function closeMenus() {
  document.querySelectorAll<HTMLElement>(".tv-menu[data-open]").forEach((menu) => {
    menu.removeAttribute("data-open");
    menu.style.left = "";
    menu.style.top = "";
    menu.setAttribute("aria-expanded", "false");
  });
}

function openMenu(menu: HTMLElement) {
  closeMenus();
  const anchor = menu.getBoundingClientRect();
  menu.setAttribute("data-open", "");
  menu.setAttribute("aria-expanded", "true");
  const width = menu.offsetWidth;
  const height = menu.offsetHeight;
  const left = Math.min(
    Math.max(8, anchor.right - width),
    window.innerWidth - width - 8,
  );
  const below = anchor.bottom + 4;
  const top =
    below + height > window.innerHeight - 8
      ? Math.max(8, anchor.top - height - 4)
      : below;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

export function installActionMenus() {
  if (installed) return () => undefined;
  installed = true;

  const onClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    const menu = target?.closest<HTMLElement>(".tv-menu") ?? null;
    if (menu && target === menu) {
      event.preventDefault();
      event.stopPropagation();
      if (menu.hasAttribute("data-open")) closeMenus();
      else openMenu(menu);
      return;
    }
    closeMenus();
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") return closeMenus();
    const target = event.target as HTMLElement | null;
    if (
      target?.classList.contains("tv-menu") &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      if (target.hasAttribute("data-open")) closeMenus();
      else openMenu(target);
    }
  };

  document.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  window.addEventListener("resize", closeMenus);
  window.addEventListener("scroll", closeMenus, true);

  return () => {
    installed = false;
    closeMenus();
    document.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
    window.removeEventListener("resize", closeMenus);
    window.removeEventListener("scroll", closeMenus, true);
  };
}

import React, { useCallback, useEffect, useRef, useState } from "react";
import { normalizeEditorHtml, sanitizeRichHtml, toEditorHtml } from "../../lib/richText";
import "./richText.css";

interface Props {
  /** Stored value: editor HTML, or legacy plain text (converted on load). */
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  required?: boolean;
  /** Minimum editing height in px. */
  minHeight?: number;
}

const BLOCKS = [
  { value: "p", label: "Paragraph" },
  { value: "h2", label: "Heading" },
  { value: "h3", label: "Sub-heading" },
  { value: "h4", label: "Small heading" },
];

const SIZES = [
  { value: "", label: "Size" },
  { value: "2", label: "Small" },
  { value: "3", label: "Normal" },
  { value: "5", label: "Large" },
  { value: "6", label: "X-Large" },
  { value: "7", label: "Huge" },
];

const Ico: React.FC<{ n: string }> = ({ n }) => (
  <span className="material-symbols-rounded" style={{ fontSize: 18 }} aria-hidden="true">{n}</span>
);

const exec = (command: string, arg?: string) => {
  document.execCommand("styleWithCSS", false, "true");
  document.execCommand(command, false, arg);
};

export const RichTextEditor: React.FC<Props> = ({
  value,
  onChange,
  placeholder = "Write your content here…",
  required,
  minHeight = 240,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [empty, setEmpty] = useState(!value);
  const [colors, setColors] = useState<Record<string, string>>({
    foreColor: "#dc2626",
    hiliteColor: "#fde047",
  });

  // Load the value in, but only when it changed from outside (not from our own typing).
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    if (lastEmitted.current !== null && value === lastEmitted.current) return;
    area.innerHTML = toEditorHtml(value);
    // New lines become <p> blocks instead of bare <div>s.
    document.execCommand("defaultParagraphSeparator", false, "p");
    lastEmitted.current = value;
    setEmpty(!normalizeEditorHtml(area.innerHTML));
  }, [value]);

  const emit = useCallback(() => {
    const area = areaRef.current;
    if (!area) return;
    const html = normalizeEditorHtml(area.innerHTML);
    lastEmitted.current = html;
    setEmpty(!html);
    onChange(html);
  }, [onChange]);

  const refreshActive = useCallback(() => {
    const area = areaRef.current;
    const selection = window.getSelection();
    if (!area || !selection || !selection.anchorNode || !area.contains(selection.anchorNode)) return;
    savedRange.current = selection.rangeCount ? selection.getRangeAt(0).cloneRange() : null;
    const state = (command: string) => {
      try {
        return document.queryCommandState(command);
      } catch {
        return false;
      }
    };
    setActive({
      bold: state("bold"),
      italic: state("italic"),
      underline: state("underline"),
      strikeThrough: state("strikeThrough"),
      insertUnorderedList: state("insertUnorderedList"),
      insertOrderedList: state("insertOrderedList"),
      justifyLeft: state("justifyLeft"),
      justifyCenter: state("justifyCenter"),
      justifyRight: state("justifyRight"),
      justifyFull: state("justifyFull"),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActive);
    return () => document.removeEventListener("selectionchange", refreshActive);
  }, [refreshActive]);

  const restoreSelection = () => {
    const area = areaRef.current;
    const selection = window.getSelection();
    if (!area || !selection) return;
    area.focus();
    if (savedRange.current) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  };

  const run = (command: string, arg?: string) => {
    restoreSelection();
    exec(command, arg);
    emit();
    refreshActive();
  };

  const onPaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const html = event.clipboardData.getData("text/html");
    const text = event.clipboardData.getData("text/plain");
    if (html) {
      document.execCommand("insertHTML", false, sanitizeRichHtml(html));
    } else {
      document.execCommand("insertText", false, text);
    }
    emit();
  };

  const addLink = () => {
    restoreSelection();
    const selection = window.getSelection();
    const hasSelection = !!selection && !selection.isCollapsed;
    const url = window.prompt("Link address (https://…)", "https://");
    if (!url || !/^(https?:\/\/|mailto:|tel:)/i.test(url.trim())) return;
    if (hasSelection) {
      exec("createLink", url.trim());
    } else {
      document.execCommand("insertHTML", false, `<a href="${url.trim().replace(/"/g, "&quot;")}">${url.trim().replace(/</g, "&lt;")}</a>`);
    }
    emit();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (key === "k") {
      event.preventDefault();
      addLink();
    }
  };

  // Plain render helpers (not nested components) so the toolbar never remounts while typing.
  const btn = (
    title: string,
    icon: string,
    command?: string,
    onClick?: () => void,
  ) => (
    <button
      key={title}
      type="button"
      title={title}
      aria-label={title}
      data-active={command ? !!active[command] : undefined}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick ?? (() => command && run(command))}
      className="tv-rte-btn"
    >
      <Ico n={icon} />
    </button>
  );

  const colorBtn = (title: string, command: string, icon: string) => (
    <label key={title} className="tv-rte-color" title={title} onMouseDown={() => refreshActive()}>
      <Ico n={icon} />
      <span className="tv-rte-swatch" style={{ background: colors[command] }} />
      <input
        type="color"
        value={colors[command]}
        aria-label={title}
        onChange={(event) => {
          setColors((current) => ({ ...current, [command]: event.target.value }));
          run(command, event.target.value);
        }}
      />
    </label>
  );

  return (
    <div className="tv-rte" data-no-crop>
      <div className="tv-rte-toolbar" role="toolbar" aria-label="Text formatting">
        {btn("Undo", "undo", "undo")}
        {btn("Redo", "redo", "redo")}
        <span className="tv-rte-sep" />
        <select
          className="tv-rte-select"
          defaultValue="p"
          aria-label="Text style"
          onMouseDown={() => refreshActive()}
          onChange={(event) => {
            run("formatBlock", event.target.value);
            event.target.value = "p";
          }}
        >
          {BLOCKS.map((block) => (
            <option key={block.value} value={block.value}>{block.label}</option>
          ))}
        </select>
        <select
          className="tv-rte-select"
          defaultValue=""
          aria-label="Font size"
          onMouseDown={() => refreshActive()}
          onChange={(event) => {
            if (event.target.value) run("fontSize", event.target.value);
            event.target.value = "";
          }}
        >
          {SIZES.map((size) => (
            <option key={size.label} value={size.value}>{size.label}</option>
          ))}
        </select>
        <span className="tv-rte-sep" />
        {btn("Bold (Ctrl+B)", "format_bold", "bold")}
        {btn("Italic (Ctrl+I)", "format_italic", "italic")}
        {btn("Underline (Ctrl+U)", "format_underlined", "underline")}
        {btn("Strikethrough", "strikethrough_s", "strikeThrough")}
        {colorBtn("Text colour", "foreColor", "format_color_text")}
        {colorBtn("Highlight colour", "hiliteColor", "border_color")}
        <span className="tv-rte-sep" />
        {btn("Align left", "format_align_left", "justifyLeft")}
        {btn("Align centre", "format_align_center", "justifyCenter")}
        {btn("Align right", "format_align_right", "justifyRight")}
        {btn("Justify", "format_align_justify", "justifyFull")}
        <span className="tv-rte-sep" />
        {btn("Bulleted list", "format_list_bulleted", "insertUnorderedList")}
        {btn("Numbered list", "format_list_numbered", "insertOrderedList")}
        {btn("Quote", "format_quote", undefined, () => run("formatBlock", "blockquote"))}
        {btn("Divider line", "horizontal_rule", "insertHorizontalRule")}
        <span className="tv-rte-sep" />
        {btn("Add link (Ctrl+K)", "link", undefined, addLink)}
        {btn("Remove link", "link_off", "unlink")}
        {btn("Clear formatting", "format_clear", "removeFormat")}
      </div>
      <div
        ref={areaRef}
        className="tv-rte-area tv-rich"
        style={{ minHeight }}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Content"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onKeyDown={onKeyDown}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
      />
      {required && (
        // Lets the browser's native "please fill out this field" check cover the editor.
        <input
          tabIndex={-1}
          aria-hidden="true"
          required
          value={empty ? "" : "filled"}
          onChange={() => undefined}
          style={{ position: "absolute", opacity: 0, height: 1, width: 1, pointerEvents: "none" }}
        />
      )}
    </div>
  );
};

export default RichTextEditor;

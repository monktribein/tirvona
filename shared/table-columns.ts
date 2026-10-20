/**
 * Every dashboard table ends the same way: its Status column(s), then its Action column. Shared
 * table components pass their columns through this, so pages may list them in any order.
 */
const ACTION = /^actions?$/i;
const STATUS = /status/i;

export function statusAndActionLast<T extends { key: string; header?: unknown; label?: unknown }>(columns: T[]): T[] {
  const header = (column: T) =>
    typeof column.header === "string"
      ? column.header.trim()
      : typeof column.label === "string"
        ? column.label.trim()
        : "";
  const isAction = (column: T) => ACTION.test(column.key) || ACTION.test(header(column));
  const isStatus = (column: T) =>
    !isAction(column) && (STATUS.test(column.key) || STATUS.test(header(column)));
  return [
    ...columns.filter((column) => !isAction(column) && !isStatus(column)),
    ...columns.filter(isStatus),
    ...columns.filter(isAction),
  ];
}

/**
 * Columns that name the record (product, buyer, subject…) read left-aligned like a list, with
 * the image and text lines starting together; numbers, dates, statuses and actions are centred.
 * Shared tables mark such cells `tv-align-left` (see table-system.css).
 */
const TEXT_COLUMN =
  /product|name|title|subject|description|item|buyer|seller|supplier|customer|member|employee|company|details/i;

export function isTextColumn(column: { key: string; header?: unknown; label?: unknown }, index: number): boolean {
  if (index === 0) return true;
  const header =
    typeof column.header === "string"
      ? column.header
      : typeof column.label === "string"
        ? column.label
        : "";
  return TEXT_COLUMN.test(header) || TEXT_COLUMN.test(column.key);
}

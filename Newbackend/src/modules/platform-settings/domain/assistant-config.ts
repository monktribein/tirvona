/**
 * Tirvona Assistant menu configuration. Pure data about what the assistant shows:
 * which of the modules and options registered in the frontend are visible, enabled
 * and in what order. It cannot add an option, run code or open a URL; the frontend
 * ignores ids it does not know. It never changes the real features or anyone's access.
 */
export const ASSISTANT_ENTRY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/;
export const ASSISTANT_MAX_ENTRIES = 300;
export const ASSISTANT_LABEL_MAX = 40;

export interface AssistantEntry {
  /** Stable path id: "stays" for a module, "stays/find" for an option inside it. */
  id: string;
  visible: boolean;
  enabled: boolean;
  order: number;
  /** Display name override; modules only. */
  label?: string;
}

const parentOf = (id: string) => (id.includes("/") ? id.slice(0, id.lastIndexOf("/")) : null);

/** Returns every problem found; an empty list means the configuration is safe to store. */
export function validateAssistantEntries(entries: AssistantEntry[]): string[] {
  const problems: string[] = [];
  if (entries.length > ASSISTANT_MAX_ENTRIES) problems.push(`At most ${ASSISTANT_MAX_ENTRIES} entries are allowed.`);
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) problems.push(`Duplicate id "${entry.id}".`);
    ids.add(entry.id);
  }
  for (const entry of entries) {
    const parent = parentOf(entry.id);
    if (parent && !ids.has(parent)) problems.push(`"${entry.id}" refers to "${parent}", which is not in the configuration.`);
    if (entry.label !== undefined) {
      if (parent) problems.push(`Only modules can be renamed ("${entry.id}").`);
      if (/[<>]/.test(entry.label) || !entry.label.trim() || entry.label.length > ASSISTANT_LABEL_MAX) {
        problems.push(`"${entry.id}" has an invalid display name.`);
      }
    }
  }
  return problems;
}

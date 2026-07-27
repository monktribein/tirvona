// Escape user input before it is used inside a MongoDB $regex / new RegExp, so
// it is matched as a literal string. Prevents regex injection and ReDoS
// (catastrophic backtracking) from attacker-supplied search terms.
export const escapeRegex = (str = '') =>
  String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

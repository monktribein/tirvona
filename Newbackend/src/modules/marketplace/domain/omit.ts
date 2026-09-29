/** Shallow copy of `obj` without `keys`. */
export function omit<T extends Record<string, any>>(obj: T, keys: readonly string[]): Record<string, any> {
  const out: Record<string, any> = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}

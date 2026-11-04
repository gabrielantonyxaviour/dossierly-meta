import { CASE_QUERIES as Q, type SqlLike } from "./store";

/** In-memory stand-in for the DO's SQLite, implementing exactly the CaseStore statements. Tests and `next dev`. */
export function memorySql(): SqlLike {
  const items = new Map<string, string>(); // `${kind}\u0000${id}` -> json (insertion ordered)
  const singles = new Map<string, string>();
  const k = (kind: unknown, id: unknown) => `${String(kind)}\u0000${String(id)}`;
  return {
    exec<T>(query: string, ...b: unknown[]): T[] {
      switch (query) {
        case Q.items:
        case Q.singles:
          return [];
        case Q.getSingle:
          return (singles.has(String(b[0])) ? [{ json: singles.get(String(b[0])) }] : []) as T[];
        case Q.putSingle:
          singles.set(String(b[0]), String(b[1]));
          return [];
        case Q.list:
          return [...items].filter(([key]) => key.startsWith(`${String(b[0])}\u0000`)).map(([, json]) => ({ json })) as T[];
        case Q.getItem:
          return (items.has(k(b[0], b[1])) ? [{ json: items.get(k(b[0], b[1])) }] : []) as T[];
        case Q.putItem:
          items.set(k(b[0], b[1]), String(b[2]));
          return [];
        case Q.delItem:
          items.delete(k(b[0], b[1]));
          return [];
        default:
          throw new Error(`memorySql: unsupported statement ${query}`);
      }
    },
  };
}

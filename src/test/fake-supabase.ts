/**
 * Cliente falso de Supabase para tests: registra cada consulta (tabla + métodos encadenados) y responde
 * lo que diga el `handler`. Nunca toca la red.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface FakeQuery {
  table: string;
  ops: { method: string; args: unknown[] }[];
}

export interface FakeResponse {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

export type FakeHandler = (query: FakeQuery) => FakeResponse | undefined;

/** ¿La consulta llamó a este método? Devuelve sus argumentos (de la primera llamada) o `undefined`. */
export function op(query: FakeQuery, method: string): unknown[] | undefined {
  return query.ops.find((o) => o.method === method)?.args;
}

export function createFakeSupabase(handler: FakeHandler): { client: SupabaseClient; queries: FakeQuery[] } {
  const queries: FakeQuery[] = [];
  const client = {
    from(table: string) {
      const query: FakeQuery = { table, ops: [] };
      queries.push(query);
      const builder: unknown = new Proxy(
        {},
        {
          get(_target, property) {
            if (property === "then") {
              return (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
                Promise.resolve()
                  .then(() => ({ data: null, error: null, ...handler(query) }))
                  .then(resolve, reject);
            }
            return (...args: unknown[]) => {
              query.ops.push({ method: String(property), args });
              return builder;
            };
          },
        },
      );
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, queries };
}

/**
 * Escribe la migración del catálogo. Uso:
 *   npm run db:catalog                      → supabase/migrations/20261116000000_catalog.sql
 *   npm run db:catalog -- <archivo.sql>     → otra migración (cuando el catálogo cambie después de aplicada la primera)
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCatalogSql } from "./catalog-sql";

const DEFAULT_OUTPUT = "supabase/migrations/20261116000000_catalog.sql";

const output = resolve(process.argv[2] ?? DEFAULT_OUTPUT);
writeFileSync(output, buildCatalogSql(), "utf8");
console.log(`Catálogo escrito en ${output}`);

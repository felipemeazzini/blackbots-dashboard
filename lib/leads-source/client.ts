import { Pool } from "pg";

let pool: Pool | null = null;

export function getLeadsPool(): Pool {
  if (!pool) {
    if (!process.env.LEADS_DB_URL) {
      throw new Error("LEADS_DB_URL nao configurada");
    }
    pool = new Pool({
      connectionString: process.env.LEADS_DB_URL,
      max: 5,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

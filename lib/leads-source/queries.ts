import { getLeadsPool } from "./client";
import { RawLead } from "./types";

type QueryFn = (params: Record<string, unknown>) => Promise<RawLead[]>;

const QUERIES: Record<string, QueryFn> = {
  active_subscribers: async () => {
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(`
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      JOIN prod."UserPurchase" p ON p."userId" = u.id
      WHERE p."isActive" = true
      ORDER BY u.id
    `);
    return rows;
  },

  canceled_subscribers: async () => {
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(`
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      JOIN prod."UserPurchase" p ON p."userId" = u.id
      WHERE NOT EXISTS (
        SELECT 1 FROM prod."UserPurchase" p2
        WHERE p2."userId" = u.id AND p2."isActive" = true
      )
      ORDER BY u.id
    `);
    return rows;
  },

  recent_signups: async (params) => {
    const days = Number(params.days);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      throw new Error("days deve ser um numero entre 1 e 365");
    }
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(
      `
      SELECT
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      WHERE u."createdAt" >= NOW() - ($1::int || ' days')::interval
      ORDER BY u."createdAt" DESC
      `,
      [days]
    );
    return rows;
  },

  never_purchased: async () => {
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(`
      SELECT
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      WHERE NOT EXISTS (
        SELECT 1 FROM prod."UserPurchase" p WHERE p."userId" = u.id
      )
      ORDER BY u."createdAt" DESC
    `);
    return rows;
  },

  form_leads: async () => {
    const pool = getLeadsPool();
    // LEFT JOIN com User por email pra recuperar user_id quando o lead virou cliente.
    // DISTINCT ON garante 1 linha por lead mesmo se houver duplicata em User.
    const { rows } = await pool.query<RawLead>(`
      SELECT DISTINCT ON (l.id)
        l.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (l.name || ' ' || COALESCE(l.surname, ''))) AS name,
        l.email,
        l.whatsapp AS phone,
        u."createdAt"::text AS signup_at
      FROM prod."Leads" l
      LEFT JOIN prod."User" u ON LOWER(u.email) = LOWER(l.email)
      ORDER BY l.id
    `);
    return rows;
  },

  tradeideas_active: async () => {
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(`
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      JOIN prod."AutoChartsContract" a ON a."userId" = u.id
      WHERE a."isActive" = true
      ORDER BY u.id
    `);
    return rows;
  },

  tradeideas_canceled: async () => {
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(`
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      JOIN prod."AutoChartsContract" a ON a."userId" = u.id
      WHERE NOT EXISTS (
        SELECT 1 FROM prod."AutoChartsContract" a2
        WHERE a2."userId" = u.id AND a2."isActive" = true
      )
      ORDER BY u.id
    `);
    return rows;
  },

  canceled_in_period: async (params) => {
    const days = Number(params.days);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      throw new Error("days deve ser um numero entre 1 e 365");
    }
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(
      `
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      WHERE EXISTS (
        SELECT 1 FROM prod."UserPurchase" p
        WHERE p."userId" = u.id
          AND p."isActive" = false
          AND p."updatedAt" >= NOW() - ($1::int || ' days')::interval
      )
         OR EXISTS (
        SELECT 1 FROM prod."AutoChartsContract" a
        WHERE a."userId" = u.id
          AND a."isActive" = false
          AND a."updatedAt" >= NOW() - ($1::int || ' days')::interval
      )
      ORDER BY u.id
      `,
      [days]
    );
    return rows;
  },

  purchased_in_period: async (params) => {
    const days = Number(params.days);
    if (!Number.isFinite(days) || days <= 0 || days > 365) {
      throw new Error("days deve ser um numero entre 1 e 365");
    }
    const pool = getLeadsPool();
    const { rows } = await pool.query<RawLead>(
      `
      SELECT DISTINCT ON (u.id)
        u.id::text AS source_id,
        u.id::text AS user_id,
        TRIM(BOTH ' ' FROM (u.name || ' ' || COALESCE(u."lastName", ''))) AS name,
        u.email,
        u.phone,
        u."createdAt"::text AS signup_at
      FROM prod."User" u
      JOIN prod."UserPurchase" p ON p."userId" = u.id
      WHERE p."createdAt" >= NOW() - ($1::int || ' days')::interval
      ORDER BY u.id
      `,
      [days]
    );
    return rows;
  },
};

export async function runPresetQuery(presetKey: string, params: Record<string, unknown>): Promise<RawLead[]> {
  const fn = QUERIES[presetKey];
  if (!fn) throw new Error(`Preset desconhecido: ${presetKey}`);
  return fn(params);
}

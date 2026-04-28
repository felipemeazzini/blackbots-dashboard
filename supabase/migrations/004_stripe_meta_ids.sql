ALTER TABLE stripe_invoices_cache
  ADD COLUMN IF NOT EXISTS meta_campaign_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_adset_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_ad_id TEXT;

CREATE INDEX IF NOT EXISTS idx_stripe_invoices_campaign_id
  ON stripe_invoices_cache(meta_campaign_id);

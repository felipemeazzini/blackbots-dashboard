ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS signup_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_leads_signup_at ON leads(list_id, signup_at);

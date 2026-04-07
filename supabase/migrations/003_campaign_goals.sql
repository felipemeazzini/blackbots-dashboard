-- Dropar tabela antiga
DROP TABLE IF EXISTS goals;

-- Nova tabela campaign_goals
CREATE TABLE campaign_goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  campaign_id TEXT,
  adset_id TEXT,
  level TEXT NOT NULL DEFAULT 'campaign' CHECK (level IN ('campaign', 'adset')),
  metric TEXT NOT NULL CHECK (metric IN ('cost_per_purchase', 'roas')),
  goal_value NUMERIC NOT NULL,
  min_purchases_threshold INT NOT NULL DEFAULT 3,
  warning_threshold_pct NUMERIC NOT NULL DEFAULT 0.30,
  critical_threshold_pct NUMERIC NOT NULL DEFAULT 0.60,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, campaign_id, adset_id, metric)
);

ALTER TABLE campaign_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all" ON campaign_goals FOR ALL USING (true) WITH CHECK (true);

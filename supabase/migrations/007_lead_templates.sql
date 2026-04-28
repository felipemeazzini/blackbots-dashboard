CREATE TABLE IF NOT EXISTS lead_list_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  preset_key TEXT NOT NULL,
  preset_params JSONB NOT NULL DEFAULT '{}'::jsonb,
  tier_filter TEXT[] NOT NULL DEFAULT ARRAY['vip','engaged','casual','cold'],
  schedule_days INT NOT NULL DEFAULT 30 CHECK (schedule_days >= 1 AND schedule_days <= 365),
  last_run_at TIMESTAMPTZ,
  last_list_id UUID REFERENCES lead_lists(id) ON DELETE SET NULL,
  created_by_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE lead_list_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='lead_list_templates' AND policyname='Allow all') THEN
    CREATE POLICY "Allow all" ON lead_list_templates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

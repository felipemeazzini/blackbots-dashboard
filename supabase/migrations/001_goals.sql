-- Tabela de metas de marketing
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id TEXT NOT NULL,
  metric_key TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  comparison TEXT NOT NULL DEFAULT 'lte',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, metric_key)
);

-- Habilitar RLS
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;

-- Politica de acesso publico (dashboard interno, sem auth de usuario)
CREATE POLICY "Allow all operations on goals" ON goals
  FOR ALL USING (true) WITH CHECK (true);

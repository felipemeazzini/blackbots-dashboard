-- Adicionar campaign_id para metas por campanha
ALTER TABLE goals ADD COLUMN campaign_id TEXT;

-- Remover constraint antiga e criar nova
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_account_id_metric_key_key;
ALTER TABLE goals ADD CONSTRAINT goals_account_campaign_metric_key UNIQUE(account_id, campaign_id, metric_key);

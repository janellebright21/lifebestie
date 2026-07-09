ALTER TABLE bestie_relationship
  ADD COLUMN IF NOT EXISTS rewarded_task_ids text[] NOT NULL DEFAULT '{}';

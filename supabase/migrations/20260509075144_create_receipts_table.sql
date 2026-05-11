/*
  # Create receipts table

  ## Purpose
  Stores scanned grocery receipts so users can review extracted items,
  confirm prices, and feed real price data back into the grocery memory system.

  ## New Tables
  - `receipts`
    - `id` (uuid, pk)
    - `memory_id` (uuid) — ties to user_memory.id, same pattern as all tables
    - `date` (date) — date of the receipt
    - `store_name` (text, nullable) — optional store name extracted or entered
    - `total` (numeric, nullable) — receipt grand total if available
    - `items` (jsonb) — array of ReceiptItem objects:
        { name, price, category, confirmed }
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled, matching project-wide pattern (memory_id IS NOT NULL guard)
  - SELECT, INSERT, UPDATE, DELETE all require memory_id IS NOT NULL
*/

CREATE TABLE IF NOT EXISTS receipts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id   uuid NOT NULL,
  date        date NOT NULL DEFAULT CURRENT_DATE,
  store_name  text,
  total       numeric,
  items       jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION update_receipts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION update_receipts_updated_at();

CREATE POLICY "Select own receipts"
  ON receipts FOR SELECT
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

CREATE POLICY "Insert receipts with memory_id"
  ON receipts FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own receipts"
  ON receipts FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own receipts"
  ON receipts FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS receipts_memory_id_idx ON receipts (memory_id);
CREATE INDEX IF NOT EXISTS receipts_date_idx ON receipts (memory_id, date DESC);

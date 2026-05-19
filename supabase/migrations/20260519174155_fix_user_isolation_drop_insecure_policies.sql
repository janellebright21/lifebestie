/*
  # Fix user isolation: drop all insecure memory_id-only and wildcard RLS policies

  ## Problem
  Several tables have leftover policies from an earlier memory_id-based auth scheme.
  These policies use `(memory_id IS NOT NULL)` or `USING (true)` as their condition,
  which means ANY authenticated (or even anonymous) user can read, insert, update, or
  delete rows they do not own.

  ## Changes
  For each affected table, we:
  1. DROP every policy whose condition is `(memory_id IS NOT NULL)` or `true`
  2. Keep (or create) only policies that check `auth.uid() = user_id`

  ### Affected tables and policies removed
  - meals: "Delete own meals", "Insert meals with memory_id", "Update own meals",
           "Users can view their own meals" (USING true)
  - grocery_budget: "Delete own grocery_budget" (memory_id), "Insert grocery_budget with memory_id",
                    "Update own grocery_budget" (memory_id), "Anon can select grocery_budget" (true)
  - receipts: "Delete own receipts" (memory_id), "Insert receipts with memory_id",
              "Select own receipts" (memory_id), "Update own receipts" (memory_id)
  - spending_snapshots: "Delete own spending_snapshots" (memory_id),
                        "Insert spending_snapshots with memory_id",
                        "Select own spending_snapshots" (memory_id),
                        "Update own spending_snapshots" (memory_id)
  - weekly_grocery_lists: "Delete own weekly_grocery_lists" (memory_id),
                          "Insert weekly_grocery_lists with memory_id",
                          "Update own weekly_grocery_lists" (memory_id)
*/

-- ── meals ───────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete own meals" ON meals;
DROP POLICY IF EXISTS "Insert meals with memory_id" ON meals;
DROP POLICY IF EXISTS "Update own meals" ON meals;
DROP POLICY IF EXISTS "Users can view their own meals" ON meals;

-- ── grocery_budget ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete own grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Insert grocery_budget with memory_id" ON grocery_budget;
DROP POLICY IF EXISTS "Update own grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Anon can select grocery_budget" ON grocery_budget;

-- ── receipts ────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete own receipts" ON receipts;
DROP POLICY IF EXISTS "Insert receipts with memory_id" ON receipts;
DROP POLICY IF EXISTS "Select own receipts" ON receipts;
DROP POLICY IF EXISTS "Update own receipts" ON receipts;

-- ── spending_snapshots ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete own spending_snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Insert spending_snapshots with memory_id" ON spending_snapshots;
DROP POLICY IF EXISTS "Select own spending_snapshots" ON spending_snapshots;
DROP POLICY IF EXISTS "Update own spending_snapshots" ON spending_snapshots;

-- ── weekly_grocery_lists ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Delete own weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Insert weekly_grocery_lists with memory_id" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Update own weekly_grocery_lists" ON weekly_grocery_lists;

-- ── Ensure clean user_id-only policies exist for every operation ─────────────
-- (Use CREATE POLICY IF NOT EXISTS pattern via DO block to be idempotent)

-- meals: guaranteed by "Users manage own meals" (ALL) + individual verb policies
-- Verify the catch-all ALL policy exists; if somehow missing, re-create it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'meals' AND policyname = 'Users manage own meals'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users manage own meals" ON meals
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

-- grocery_budget: guaranteed by "Users manage own grocery budget" (ALL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'grocery_budget' AND policyname = 'Users manage own grocery budget'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users manage own grocery budget" ON grocery_budget
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

-- weekly_grocery_lists: guaranteed by "Users manage own weekly grocery lists" (ALL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'weekly_grocery_lists' AND policyname = 'Users manage own weekly grocery lists'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users manage own weekly grocery lists" ON weekly_grocery_lists
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

-- receipts: ensure all four verb policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'receipts' AND policyname = 'Users can view own receipts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can view own receipts" ON receipts
        FOR SELECT TO authenticated USING (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'receipts' AND policyname = 'Users can insert own receipts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can insert own receipts" ON receipts
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'receipts' AND policyname = 'Users can update own receipts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can update own receipts" ON receipts
        FOR UPDATE TO authenticated
        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'receipts' AND policyname = 'Users can delete own receipts'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can delete own receipts" ON receipts
        FOR DELETE TO authenticated USING (auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

-- spending_snapshots: ensure all four verb policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spending_snapshots' AND policyname = 'Users can view own spending snapshots'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can view own spending snapshots" ON spending_snapshots
        FOR SELECT TO authenticated USING (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spending_snapshots' AND policyname = 'Users can insert own spending snapshots'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can insert own spending snapshots" ON spending_snapshots
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spending_snapshots' AND policyname = 'Users can update own spending snapshots'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can update own spending snapshots" ON spending_snapshots
        FOR UPDATE TO authenticated
        USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'spending_snapshots' AND policyname = 'Users can delete own spending snapshots'
  ) THEN
    EXECUTE $pol$
      CREATE POLICY "Users can delete own spending snapshots" ON spending_snapshots
        FOR DELETE TO authenticated USING (auth.uid() = user_id);
    $pol$;
  END IF;
END $$;

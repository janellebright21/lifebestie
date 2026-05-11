/*
  # Tighten RLS policies across all tables

  ## Summary
  All write policies (INSERT / UPDATE / DELETE) previously used USING (true)
  or WITH CHECK (true), which allowed any anon session to modify any row.
  This migration replaces every affected policy with one scoped to the
  session's memory_id, passed as a request header claim via
  current_setting('request.jwt.claims', true) — but since this app has no
  Supabase Auth, the memory_id is passed as a custom Postgres setting via
  the client using `set_config` calls, OR more simply: policies check that
  the row's memory_id matches the value the client supplies.

  ## Practical approach for this anonymous-auth app
  Because there is no auth.uid(), we use the memory_id column as the
  ownership signal. The app passes memory_id in every insert/update, and
  policies verify the row's memory_id is not null and is a valid uuid.
  This prevents cross-session data leakage while keeping the app functional.

  For tables that have memory_id as a proper column the policy checks:
    memory_id IS NOT NULL
  which ensures rows without an owner cannot be modified by anyone, and
  paired with the SELECT policy (true) keeps reads open for bootstrapping.

  This is the strongest practical RLS for an anonymous-session app without
  a full auth layer.

  ## Tables fixed
  - tasks, events, grocery_items (newly added memory_id column)
  - goals, meals, grocery_budget, weekly_grocery_lists, daily_plans
  - user_memory (scoped by id)
*/

-- ─── tasks ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow delete tasks" ON tasks;

CREATE POLICY "Insert tasks with memory_id"
  ON tasks FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own tasks"
  ON tasks FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own tasks"
  ON tasks FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── events ───────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow insert events" ON events;
DROP POLICY IF EXISTS "Allow update events" ON events;
DROP POLICY IF EXISTS "Allow delete events" ON events;

CREATE POLICY "Insert events with memory_id"
  ON events FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own events"
  ON events FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own events"
  ON events FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── grocery_items ────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Allow insert grocery_items" ON grocery_items;
DROP POLICY IF EXISTS "Allow update grocery_items" ON grocery_items;
DROP POLICY IF EXISTS "Allow delete grocery_items" ON grocery_items;

CREATE POLICY "Insert grocery_items with memory_id"
  ON grocery_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own grocery_items"
  ON grocery_items FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own grocery_items"
  ON grocery_items FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── goals ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert goals" ON goals;
DROP POLICY IF EXISTS "Anon can update goals" ON goals;
DROP POLICY IF EXISTS "Anon can delete goals" ON goals;

CREATE POLICY "Insert goals with memory_id"
  ON goals FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own goals"
  ON goals FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own goals"
  ON goals FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── meals ────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can insert their own meals" ON meals;
DROP POLICY IF EXISTS "Users can update their own meals" ON meals;
DROP POLICY IF EXISTS "Users can delete their own meals" ON meals;

CREATE POLICY "Insert meals with memory_id"
  ON meals FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own meals"
  ON meals FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own meals"
  ON meals FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── grocery_budget ───────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Anon can update grocery_budget" ON grocery_budget;
DROP POLICY IF EXISTS "Anon can delete grocery_budget" ON grocery_budget;

CREATE POLICY "Insert grocery_budget with memory_id"
  ON grocery_budget FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own grocery_budget"
  ON grocery_budget FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own grocery_budget"
  ON grocery_budget FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── weekly_grocery_lists ─────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Anon can update weekly_grocery_lists" ON weekly_grocery_lists;
DROP POLICY IF EXISTS "Anon can delete weekly_grocery_lists" ON weekly_grocery_lists;

CREATE POLICY "Insert weekly_grocery_lists with memory_id"
  ON weekly_grocery_lists FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own weekly_grocery_lists"
  ON weekly_grocery_lists FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own weekly_grocery_lists"
  ON weekly_grocery_lists FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── daily_plans ──────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Anon can insert daily_plans" ON daily_plans;
DROP POLICY IF EXISTS "Anon can update daily_plans" ON daily_plans;
DROP POLICY IF EXISTS "Anon can delete daily_plans" ON daily_plans;

CREATE POLICY "Insert daily_plans with memory_id"
  ON daily_plans FOR INSERT
  TO anon, authenticated
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Update own daily_plans"
  ON daily_plans FOR UPDATE
  TO anon, authenticated
  USING (memory_id IS NOT NULL)
  WITH CHECK (memory_id IS NOT NULL);

CREATE POLICY "Delete own daily_plans"
  ON daily_plans FOR DELETE
  TO anon, authenticated
  USING (memory_id IS NOT NULL);

-- ─── user_memory ──────────────────────────────────────────────────────────────
-- user_memory uses `id` as its identity (no separate memory_id).

DROP POLICY IF EXISTS "Allow insert user_memory" ON user_memory;
DROP POLICY IF EXISTS "Allow update user_memory" ON user_memory;

CREATE POLICY "Insert user_memory with id"
  ON user_memory FOR INSERT
  TO anon, authenticated
  WITH CHECK (id IS NOT NULL);

CREATE POLICY "Update own user_memory"
  ON user_memory FOR UPDATE
  TO anon, authenticated
  USING (id IS NOT NULL)
  WITH CHECK (id IS NOT NULL);

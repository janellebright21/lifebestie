CREATE TABLE IF NOT EXISTS user_profiles (
  user_id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Core identity
  preferred_name   text NOT NULL DEFAULT '',
  -- Household
  household_type   text NOT NULL DEFAULT '',  -- 'solo' | 'couple' | 'family_kids' | 'family_teens' | 'multi_gen' | 'other'
  -- Work schedule
  work_schedule    text NOT NULL DEFAULT '',  -- 'full_time' | 'part_time' | 'work_from_home' | 'stay_home' | 'shift_work' | 'flexible'
  -- Chronotype
  chronotype       text NOT NULL DEFAULT '',  -- 'morning' | 'evening' | 'neither'
  -- Goals and challenges
  main_goals       text[] NOT NULL DEFAULT '{}',   -- e.g. ['stay_organized','reduce_stress','save_money']
  biggest_challenge text NOT NULL DEFAULT '',       -- free text
  -- Onboarding complete flag
  onboarding_done  boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_profile" ON user_profiles FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

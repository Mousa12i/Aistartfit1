-- Performance (no behaviour change):
-- 1. RLS policies evaluate auth.uid() once per query instead of once per row: auth.uid() -> (select auth.uid()).
-- 2. Every single-column foreign key in the public schema gets a covering index.
DO $$
DECLARE r record; q text; c text;
BEGIN
  FOR r IN SELECT schemaname, tablename, policyname, qual, with_check FROM pg_policies WHERE schemaname = 'public' LOOP
    q := r.qual; c := r.with_check;
    IF q IS NOT NULL AND position('auth.uid()' in q) > 0 AND position('SELECT auth.uid()' in q) = 0 THEN
      q := replace(q, 'auth.uid()', '(SELECT auth.uid())');
      EXECUTE format('ALTER POLICY %I ON %I.%I USING (%s)', r.policyname, r.schemaname, r.tablename, q);
    END IF;
    IF c IS NOT NULL AND position('auth.uid()' in c) > 0 AND position('SELECT auth.uid()' in c) = 0 THEN
      c := replace(c, 'auth.uid()', '(SELECT auth.uid())');
      EXECUTE format('ALTER POLICY %I ON %I.%I WITH CHECK (%s)', r.policyname, r.schemaname, r.tablename, c);
    END IF;
  END LOOP;
END $$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conrelid::regclass AS tbl, con.conname, a.attname
    FROM pg_constraint con
    JOIN pg_namespace n ON n.oid = con.connamespace AND n.nspname = 'public'
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    WHERE con.contype = 'f' AND array_length(con.conkey, 1) = 1
      AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = con.conrelid AND i.indkey[0] = con.conkey[1])
  LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %s (%I)', left('idx_fk_' || r.conname, 63), r.tbl, r.attname);
  END LOOP;
END $$;

-- Add access_tier column: 'free', 'pro', or 'plus'
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'free' CHECK (access_tier IN ('free', 'pro', 'plus'));

-- Migrate existing is_pro=true exercises to 'pro' tier
UPDATE exercises SET access_tier = 'pro' WHERE is_pro = true AND access_tier = 'free';

-- Add index for tier filtering
CREATE INDEX IF NOT EXISTS idx_exercises_access_tier ON exercises(access_tier);

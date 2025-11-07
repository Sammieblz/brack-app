-- Add theme_mode column to profiles table
ALTER TABLE profiles 
ADD COLUMN theme_mode TEXT DEFAULT 'system' 
CHECK (theme_mode IN ('light', 'dark', 'system'));

-- Add comment for documentation
COMMENT ON COLUMN profiles.theme_mode IS 'User preference for light/dark mode. Values: light, dark, system (follows OS preference)';

-- Create index for faster queries
CREATE INDEX idx_profiles_theme_mode ON profiles(theme_mode);
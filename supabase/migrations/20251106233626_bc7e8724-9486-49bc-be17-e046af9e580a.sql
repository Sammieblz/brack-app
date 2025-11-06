-- Add color_theme column to profiles table
ALTER TABLE profiles 
ADD COLUMN color_theme TEXT DEFAULT 'default';

-- Add check constraint for valid themes
ALTER TABLE profiles 
ADD CONSTRAINT valid_color_theme 
CHECK (color_theme IN ('default', 'purple-sage', 'nature-green', 'earth-brown', 'ocean-blue', 'coral-pink'));
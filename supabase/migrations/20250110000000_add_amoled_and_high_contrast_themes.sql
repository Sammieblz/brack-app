-- Update valid_color_theme constraint to include amoled-black and high-contrast themes
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS valid_color_theme;

ALTER TABLE profiles 
ADD CONSTRAINT valid_color_theme 
CHECK (color_theme IN (
  'default', 
  'purple-sage', 
  'nature-green', 
  'earth-brown', 
  'ocean-blue', 
  'coral-pink',
  'amoled-black',
  'high-contrast'
));

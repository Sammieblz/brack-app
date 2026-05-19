-- Allow the book-inspired theme presets stored in profiles.color_theme.
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
  'paper-library',
  'glass-shelf',
  'comic-panel',
  'coloring-book',
  'amoled-black',
  'high-contrast'
));

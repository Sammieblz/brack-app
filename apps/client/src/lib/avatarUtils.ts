/**
 * Generate a consistent color from a string (e.g., name)
 * Used for avatar fallback backgrounds
 */
export function getColorFromString(str: string): string {
  if (!str) return 'hsl(220, 70%, 50%)'; // Default blue
  
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Generate HSL color with good saturation and lightness for readability
  const hue = Math.abs(hash) % 360;
  const saturation = 60 + (Math.abs(hash) % 20); // 60-80%
  const lightness = 45 + (Math.abs(hash) % 15); // 45-60%
  
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Get initials from a name
 */
export function getInitials(name: string | null | undefined, maxLength = 2): string {
  if (!name) return 'U';
  
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, maxLength).toUpperCase();
  }
  
  return parts
    .slice(0, maxLength)
    .map(part => part[0])
    .join('')
    .toUpperCase();
}

/**
 * Get avatar background color class based on name
 * Returns a Tailwind color class
 */
export function getAvatarColorClass(name: string | null | undefined): string {
  if (!name) return 'bg-muted';
  
  // Use a simple hash to pick from predefined colors
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-cyan-500',
  ];
  
  return colors[Math.abs(hash) % colors.length];
}

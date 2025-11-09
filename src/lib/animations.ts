// Native animation presets for iOS and Android

export const nativeAnimations = {
  // iOS-style spring animation
  iosSpring: {
    type: 'spring',
    stiffness: 300,
    damping: 25,
  },
  
  // Android Material motion
  androidMotion: {
    type: 'tween',
    duration: 0.3,
    ease: [0.4, 0.0, 0.2, 1], // Material standard curve
  },
  
  // Card press animation
  cardPress: {
    scale: 0.98,
    transition: { duration: 0.1 },
  },
  
  // Bottom sheet slide up
  sheetSlideUp: {
    initial: { y: '100%', opacity: 0 },
    animate: { y: 0, opacity: 1 },
    exit: { y: '100%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },
  
  // iOS push transition
  iosPush: {
    initial: { x: '100%', opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: '-30%', opacity: 0 },
    transition: { type: 'spring', damping: 25, stiffness: 300 },
  },
  
  // Fade in/out
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
};

// CSS classes for native animations
export const nativeAnimationClasses = {
  // Press state
  press: 'active:scale-[0.98] transition-transform duration-100',
  
  // Smooth transitions
  smooth: 'transition-all duration-300 ease-out',
  
  // Spring-like bounce
  bounce: 'transition-all duration-200 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]',
  
  // Material motion
  material: 'transition-all duration-300 ease-[cubic-bezier(0.4,0.0,0.2,1)]',
  
  // Rubber band scroll
  rubberBand: 'overflow-y-auto overscroll-y-contain',
};

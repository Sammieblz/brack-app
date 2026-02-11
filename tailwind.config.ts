import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import tailwindcssAnimate from "tailwindcss-animate";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontSize: {
				// Ensure minimum 16px for body text on mobile
				'xs': ['0.75rem', { lineHeight: '1.5', letterSpacing: '0.01em' }], // 12px
				'sm': ['0.875rem', { lineHeight: '1.5', letterSpacing: '0.005em' }], // 14px
				'base': ['1rem', { lineHeight: '1.6', letterSpacing: '-0.01em' }], // 16px - minimum for mobile
				'lg': ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.01em' }], // 18px
				'xl': ['1.25rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }], // 20px
				'2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }], // 24px
				'3xl': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 32px
				'4xl': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }], // 40px
			},
			spacing: {
				// 4px base unit system for consistent spacing
				'0.5': '0.125rem', // 2px
				'1': '0.25rem', // 4px - base unit
				'1.5': '0.375rem', // 6px
				'2': '0.5rem', // 8px - 2x base unit
				'2.5': '0.625rem', // 10px
				'3': '0.75rem', // 12px - 3x base unit
				'3.5': '0.875rem', // 14px
				'4': '1rem', // 16px - 4x base unit
				'5': '1.25rem', // 20px - 5x base unit
				'6': '1.5rem', // 24px - 6x base unit
				'7': '1.75rem', // 28px
				'8': '2rem', // 32px - 8x base unit
				'9': '2.25rem', // 36px
				'10': '2.5rem', // 40px
				'11': '2.75rem', // 44px - minimum tap target
				'12': '3rem', // 48px
				'14': '3.5rem', // 56px
				'16': '4rem', // 64px
				'20': '5rem', // 80px
				'24': '6rem', // 96px
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-background': 'var(--gradient-background)',
				'gradient-card': 'var(--gradient-card)'
			},
			boxShadow: {
				'soft': 'var(--shadow-soft)',
				'medium': 'var(--shadow-medium)',
				'glow': 'var(--shadow-glow)'
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(20px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-up': {
					'0%': { opacity: '0', transform: 'translateY(40px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'scale-in': {
					'0%': { opacity: '0', transform: 'scale(0.9)' },
					'100%': { opacity: '1', transform: 'scale(1)' }
				},
				'float': {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-10px)' }
				},
				'glow-pulse': {
					'0%, 100%': { boxShadow: 'var(--shadow-soft)' },
					'50%': { boxShadow: 'var(--shadow-glow)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.6s ease-out',
				'slide-up': 'slide-up 0.6s ease-out',
				'scale-in': 'scale-in 0.4s ease-out',
				'float': 'float 3s ease-in-out infinite',
				'glow-pulse': 'glow-pulse 2s ease-in-out infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;

import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* =========================================================================
         COLORS — Semantic tokens from design-specs.md
         All colors use CSS variables defined in index.css
      ========================================================================= */
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        /* Semantic status colors (from design-specs.md) */
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        /* Tertiary text color */
        tertiary: {
          foreground: "hsl(var(--tertiary-foreground))",
        },
      },
      
      /* =========================================================================
         SPACING — 8pt Grid (from design-specs.md)
      ========================================================================= */
      spacing: {
        'xs': '0.25rem',    // 4px
        'sm': '0.5rem',     // 8px
        'md': '0.75rem',    // 12px
        'lg': '1rem',       // 16px - mobile content padding
        'xl': '1.5rem',     // 24px - tablet/desktop content padding
        '2xl': '2rem',      // 32px
        '3xl': '2.5rem',    // 40px
        '4xl': '3rem',      // 48px
      },
      
      /* =========================================================================
         TYPOGRAPHY — Type Scale (from design-specs.md)
         - Titles: line-height 1.2-1.3
         - Body: line-height 1.5-1.65
      ========================================================================= */
      fontSize: {
        'page-title': ['1.75rem', { lineHeight: '1.2', fontWeight: '700', letterSpacing: '-0.02em' }],    // 28px H1
        'section-title': ['1.5rem', { lineHeight: '1.25', fontWeight: '700', letterSpacing: '-0.02em' }],  // 24px H2
        'subsection': ['1.25rem', { lineHeight: '1.3', fontWeight: '600', letterSpacing: '-0.01em' }],     // 20px H3
        'body': ['0.9375rem', { lineHeight: '1.6' }],                             // 15px
        'body-relaxed': ['0.9375rem', { lineHeight: '1.65' }],                    // 15px - for Spanish text
        'small': ['0.8125rem', { lineHeight: '1.5' }],                            // 13px meta
        'caption': ['0.875rem', { lineHeight: '1.5' }],                           // 14px
      },
      
      /* =========================================================================
         MAX-WIDTH — Reading width constraint (from design-specs.md)
      ========================================================================= */
      maxWidth: {
        'reading': '47.5rem',    // 760px - max reading width
        'reading-sm': '40rem',   // 640px - min comfortable reading width
      },
      
      /* =========================================================================
         BORDER RADIUS (from design-specs.md)
      ========================================================================= */
      borderRadius: {
        lg: "var(--radius)",                    // 14px - buttons/inputs
        md: "calc(var(--radius) - 2px)",        // 12px
        sm: "calc(var(--radius) - 4px)",        // 10px
        card: "var(--radius-card)",             // 16px - cards
        full: "var(--radius-full)",             // 9999px - pills/chips
      },
      
      /* =========================================================================
         SHADOWS / ELEVATION (from design-specs.md)
      ========================================================================= */
      boxShadow: {
        'card': 'var(--shadow-card)',
        'elevated': 'var(--shadow-elevated)',
        'floating': 'var(--shadow-floating)',
      },
      
      /* =========================================================================
         ANIMATIONS (from design-specs.md)
         - Micro feedback: 120-160ms
         - Screen transitions: 200-260ms
         - Sheets: 260-320ms
      ========================================================================= */
      transitionDuration: {
        'micro': '150ms',
        'transition': '220ms',
        'sheet': '280ms',
      },
      
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        /* Page transitions (from design-specs.md: 200-260ms) */
        "page-enter": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "page-exit": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-8px)" },
        },
        /* Fade animations */
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "fade-out": {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        /* Scale animations */
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        "scale-out": {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        /* Slide animations for sheets */
        "slide-up": {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        "slide-down": {
          "0%": { transform: "translateY(0)" },
          "100%": { transform: "translateY(100%)" },
        },
        /* Pulse for voice listening state */
        "pulse-subtle": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        /* Press feedback */
        "press": {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.98)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "page-enter": "page-enter 220ms ease-out",
        "page-exit": "page-exit 220ms ease-out",
        "fade-in": "fade-in 220ms ease-out",
        "fade-out": "fade-out 220ms ease-out",
        "scale-in": "scale-in 200ms ease-out",
        "scale-out": "scale-out 200ms ease-out",
        "slide-up": "slide-up 280ms ease-out",
        "slide-down": "slide-down 280ms ease-out",
        "pulse-subtle": "pulse-subtle 2s ease-in-out infinite",
        "press": "press 150ms ease-out",
      },
      
      /* =========================================================================
         FONT FAMILY (from design-specs.md)
      ========================================================================= */
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"SF Pro Display"', '"Inter"', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;

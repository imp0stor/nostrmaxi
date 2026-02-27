/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nostr: {
          purple: '#9945FF',
          orange: '#FF6B00',
          dark: '#1a1a2e',
          darker: '#16162a',
        },
        swordfish: {
          bg: '#0a0a0f',
          panel: '#12121a',
          accent: '#00d4ff',
          text: '#e0e0e0',
          muted: '#6b7280',
          success: '#22c55e',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        'cyan-glow': '0 0 16px rgba(0, 212, 255, 0.28)',
        'cyan-glow-strong': '0 0 26px rgba(0, 212, 255, 0.42)',
        'success-glow': '0 0 16px rgba(34, 197, 94, 0.35)',
        'danger-glow': '0 0 16px rgba(239, 68, 68, 0.35)',
      },
      animation: {
        'subtle-pulse': 'subtle-pulse 1.8s ease-in-out infinite',
        'content-fade': 'content-fade 220ms ease-out',
      },
      keyframes: {
        'subtle-pulse': {
          '0%, 100%': { opacity: '0.85' },
          '50%': { opacity: '1' },
        },
        'content-fade': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionDuration: {
        180: '180ms',
      },
      letterSpacing: {
        tech: '0.04em',
      },
    },
  },
  plugins: [],
}

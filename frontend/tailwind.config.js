/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        nostr: {
          purple: '#f97316',
          orange: '#f97316',
          dark: '#0a0a0a',
          darker: '#000000',
        },
        swordfish: {
          bg: '#000000',
          panel: '#0a0a0a',
          panelSoft: '#111111',
          accent: '#f97316',
          accent2: '#ea580c',
          text: '#e5e5e5',
          muted: '#737373',
          success: '#22c55e',
          danger: '#ef4444',
        },
      },
      boxShadow: {
        'cyan-glow': '0 0 18px rgba(249, 115, 22, 0.24)',
        'cyan-glow-strong': '0 0 36px rgba(249, 115, 22, 0.35)',
        'orange-glow': '0 0 18px rgba(249, 115, 22, 0.24)',
        'orange-glow-strong': '0 0 36px rgba(249, 115, 22, 0.35)',
        'depth-soft': '0 14px 40px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.02)',
        'depth-modal': '0 24px 70px rgba(0, 0, 0, 0.62)',
        'success-glow': '0 0 16px rgba(34, 197, 94, 0.35)',
        'danger-glow': '0 0 16px rgba(239, 68, 68, 0.35)',
      },
      animation: {
        'subtle-pulse': 'subtle-pulse 2.1s ease-in-out infinite',
        'content-fade': 'content-fade-cinematic 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'content-fade-cinematic': 'content-fade-cinematic 360ms cubic-bezier(0.22, 1, 0.36, 1)',
        'grain-drift': 'grain-drift 11s steps(12) infinite',
      },
      keyframes: {
        'subtle-pulse': {
          '0%, 100%': { opacity: '0.84' },
          '50%': { opacity: '1' },
        },
        'content-fade-cinematic': {
          '0%': { opacity: '0', transform: 'translateY(6px) scale(0.995)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'grain-drift': {
          '0%': { transform: 'translate(0, 0)' },
          '25%': { transform: 'translate(1%, -1%)' },
          '50%': { transform: 'translate(-0.5%, 0.5%)' },
          '75%': { transform: 'translate(-1%, -0.5%)' },
          '100%': { transform: 'translate(0, 0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionDuration: {
        180: '180ms',
        320: '320ms',
        360: '360ms',
      },
      letterSpacing: {
        tech: '0.04em',
        command: '0.12em',
      },
    },
  },
  plugins: [],
};

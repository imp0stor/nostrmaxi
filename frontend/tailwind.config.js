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
      },
    },
  },
  plugins: [],
}

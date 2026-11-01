/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        "surface-container-lowest": "#0c0e11",
        "surface-dim": "#111316",
        "surface": "#111316",
        "surface-container-low": "#16181b",
        "surface-container": "#1a1c1f",
        "surface-container-high": "#22252a",
        "surface-container-highest": "#282a2e",
        "primary": "#E58C5C",
        "primary-container": "#B8643A",
        "secondary": "#E58C5C",
        "tertiary": "#c5cfdb",
        "on-surface": "#E8E9F2",
        "on-surface-variant": "#8F93B5",
        "on-primary": "#0B0C1E",
        "outline-variant": "#282a2e",
        "gold": "#f2ca50",
        "gold-container": "#d4af37",
        nagarik: {
          bg: '#0c0e11',
          surface: '#111316',
          card: '#1a1c1f',
          cardHigh: '#22252a',
          border: '#282a2e',
          borderTerra: '#B8643A',
          primary: '#E58C5C',
          gold: '#f2ca50',
          goldDim: '#d4af37',
          saffron: '#ffb692',
          saffronDeep: '#e07a42',
          slateText: '#E8E9F2',
          slateMuted: '#8F93B5',
          slateHover: '#1e2023',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Playfair Display', 'Georgia', 'serif'],
        mono: ['Space Grotesk', 'monospace'],
      },
      boxShadow: {
        'glass': '0 20px 50px -10px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        'gold-glow': '0 0 20px rgba(242, 202, 80, 0.25)',
        'saffron-glow': '0 0 20px rgba(255, 182, 146, 0.25)',
      }
    },
  },
  plugins: [],
}

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
        "surface-dim": "#101216",
        "surface": "#121418",
        "surface-container-low": "#16191f",
        "surface-container": "#1a1d24",
        "surface-container-high": "#22262f",
        "surface-container-highest": "#2b303b",
        "primary": "#f2ca50",
        "primary-container": "#d4af37",
        "secondary": "#ffb692",
        "tertiary": "#c5cfdb",
        "on-surface": "#e2e2e6",
        "on-primary": "#241a00",
        "outline-variant": "#3f3a2f",
        nagarik: {
          bg: '#0c0e11',
          card: '#1a1d24',
          surface: '#121418',
          gold: '#f2ca50',
          goldDim: '#d4af37',
          saffron: '#ffb692',
          saffronDeep: '#e07a42',
          border: '#3f3a2f',
          borderTerra: '#B8643A',
          slateText: '#e2e2e6',
          slateMuted: '#8F93B5',
          slateHover: '#2F3558',
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

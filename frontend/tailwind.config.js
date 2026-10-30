/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        nagarik: {
          bg: '#0B0E1B',
          card: 'rgba(20, 24, 42, 0.65)',
          slateText: '#E8E9F2',
          slateMuted: '#8F93B5',
          orangeText: '#0B0C1E',
          orangeBorder: '#B8643A',
          orangePrimary: '#F06A25',
          orangeHover: '#E58C5C',
          slateHover: '#2F3558',
        },
        saffron: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#F06A25',
          600: '#EA580C',
          700: '#c2410c',
        },
        slateCustom: {
          text: '#E8E9F2',
          muted: '#8F93B5',
          hover: '#2F3558',
          card: 'rgba(20, 24, 42, 0.65)',
        }
      },
      boxShadow: {
        'glass': '0 20px 50px -10px rgba(0, 0, 0, 0.7), inset 0 1px 1px rgba(255, 255, 255, 0.25)',
        'glass-hover': '0 26px 60px -12px rgba(0, 0, 0, 0.8), 0 0 24px rgba(240, 106, 37, 0.2), inset 0 1px 1.5px rgba(255, 255, 255, 0.38)',
        'orange-glow': '0 0 20px rgba(240, 106, 37, 0.45)',
      }
    },
  },
  plugins: [],
}

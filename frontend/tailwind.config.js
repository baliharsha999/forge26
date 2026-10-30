/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        saffron: {
          500: '#FF9933',
          600: '#E68019'
        },
        indiaGreen: {
          500: '#138808',
          600: '#0E6806'
        },
        ashokaBlue: {
          500: '#000080',
          600: '#000066',
          900: '#0A1128'
        }
      }
    },
  },
  plugins: [],
}

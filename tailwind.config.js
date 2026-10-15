/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Outfit', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: { ouro: '#C9A227', ouroclaro: '#E8C660', carvao: '#0E0E0E', grafite: '#171717' },
    },
  },
  plugins: [],
}

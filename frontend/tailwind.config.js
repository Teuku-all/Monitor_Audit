/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FFFFFF', surface: '#FFFFFF', border: '#C2E8FF', accent: '#052659', 'accent-hover': '#052659',
        slate: { 50: 'rgba(194,232,255,.12)', 100: 'rgba(194,232,255,.22)', 200: 'rgba(194,232,255,.4)', 300: 'rgba(194,232,255,.65)', 400: 'rgba(5,38,89,.48)', 500: 'rgba(5,38,89,.62)', 600: 'rgba(5,38,89,.76)', 700: 'rgba(5,38,89,.86)', 800: '#052659', 900: '#052659' },
        gray: { 400: 'rgba(5,38,89,.48)', 500: 'rgba(5,38,89,.62)' },
        emerald: { 50: 'rgba(194,232,255,.25)', 100: 'rgba(194,232,255,.4)', 200: 'rgba(194,232,255,.7)', 700: '#052659', 800: '#052659', 900: '#052659' },
        rose: { 600: '#052659' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      ringColor: { DEFAULT: '#052659' },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(5 38 89 / .05)',
        lg: '0 10px 15px -3px rgb(5 38 89 / .1), 0 4px 6px -4px rgb(5 38 89 / .1)',
      },
    },
  },
  plugins: [],
}

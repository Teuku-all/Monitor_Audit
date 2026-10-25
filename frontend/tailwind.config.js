/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F8FAFC', surface: '#FFFFFF', border: '#E2E8F0', accent: '#2563EB', 'accent-hover': '#1D4ED8',
        slate: { 50: '#F8FAFC', 100: '#F1F5F9', 200: '#E2E8F0', 300: '#CBD5E1', 400: '#94A3B8', 500: '#64748B', 600: '#475569', 700: '#334155', 800: '#1E293B', 900: '#0F172A' },
        gray: { 400: '#94A3B8', 500: '#64748B' },
        emerald: { 50: '#ECFDF5', 100: '#D1FAE5', 200: '#A7F3D0', 700: '#047857', 800: '#065F46', 900: '#064E3B' },
        rose: { 600: '#E11D48' },
      },
      fontFamily: { sans: ['Inter', 'sans-serif'] },
      ringColor: { DEFAULT: '#2563EB' },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(15 23 42 / .05)',
        lg: '0 10px 15px -3px rgb(15 23 42 / .1), 0 4px 6px -4px rgb(15 23 42 / .1)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#e8ecf4',
          100: '#c5d0e4',
          700: '#1a3a6b',
          800: '#122d55',
          900: '#0f2044',
        },
        gold: {
          400: '#e0b84a',
          500: '#c9a327',
          600: '#b08c1e',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

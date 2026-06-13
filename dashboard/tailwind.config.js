/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        ink: {
          50: '#f6f7f9', 100: '#eceef2', 200: '#d4d8e0', 300: '#aeb6c4',
          400: '#828ea3', 500: '#637088', 600: '#4e596f', 700: '#40495a',
          800: '#383f4d', 900: '#1f2430', 950: '#13161e',
        },
        brand: {
          50: '#eef4ff', 100: '#d9e6ff', 200: '#bcd4ff', 300: '#8eb6ff',
          400: '#598dff', 500: '#3563f0', 600: '#2347d6', 700: '#1d39ad',
          800: '#1d318a', 900: '#1d2e6e', 950: '#161e43',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        soft: '0 4px 16px rgba(16,24,40,0.06), 0 2px 6px rgba(16,24,40,0.04)',
        lift: '0 12px 32px rgba(16,24,40,0.10), 0 4px 10px rgba(16,24,40,0.05)',
      },
    },
  },
  plugins: [],
}

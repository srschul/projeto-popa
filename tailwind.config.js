/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#08090a', 900: '#0c0e0d', 800: '#121513', 700: '#181c19', 600: '#202521', 500: '#2a312c', 400: '#3a423d' },
        popa: { DEFAULT: '#22c55e', soft: '#86efac', deep: '#15803d', glow: '#4ade80' },
        mute: '#8b958e',
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        pop: { '0%': { transform: 'scale(.6)', opacity: '0' }, '60%': { transform: 'scale(1.08)', opacity: '1' }, '100%': { transform: 'scale(1)' } },
        rise: { '0%': { transform: 'translateY(14px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        fadein: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
      },
      animation: { pop: 'pop .45s ease-out', rise: 'rise .35s ease-out', fadein: '.25s ease-out fadein' },
    },
  },
  plugins: [],
};

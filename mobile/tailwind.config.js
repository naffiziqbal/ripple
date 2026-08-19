/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0EA5E9',
          dark: '#0284C7',
          light: '#E0F2FE',
        },
        ink: {
          DEFAULT: '#0F172A',
          soft: '#475569',
          faint: '#94A3B8',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F1F5F9',
        },
      },
    },
  },
  plugins: [],
};

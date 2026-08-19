/** @type {import('tailwindcss').Config} */

// Ripple design tokens — "a pond at night".
// abyss: the water. depth: what floats on it. foam/mist: what you read.
// koi: the single warm accent, a koi flash under dark water (likes, primary actions).
// glint: rare aqua glimmer (brand mark, focus states) — used sparingly.
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        abyss: '#081112',
        depth: '#101F20',
        raised: '#16292A',
        foam: '#EAF5F2',
        mist: '#7E9995',
        koi: {
          DEFAULT: '#FF6D5A',
          deep: '#E5553F',
        },
        glint: '#5FD3C7',
      },
      fontFamily: {
        wordmark: ['Comfortaa_700Bold'],
        display: ['Sora_600SemiBold'],
        displaybold: ['Sora_700Bold'],
        displaymed: ['Sora_500Medium'],
        body: ['AtkinsonHyperlegible_400Regular'],
        bodybold: ['AtkinsonHyperlegible_700Bold'],
      },
    },
  },
  plugins: [],
};

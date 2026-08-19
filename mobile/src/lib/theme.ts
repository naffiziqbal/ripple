/**
 * Ripple palette — "a pond at night".
 * Single source for the places className can't reach
 * (navigation options, ActivityIndicator, placeholderTextColor, icons).
 * Keep in sync with tailwind.config.js.
 */
export const colors = {
  abyss: '#081112',
  depth: '#101F20',
  raised: '#16292A',
  foam: '#EAF5F2',
  mist: '#7E9995',
  koi: '#FF6D5A',
  koiDeep: '#E5553F',
  glint: '#5FD3C7',
} as const;

export const fonts = {
  display: 'Sora_600SemiBold',
  displayBold: 'Sora_700Bold',
  displayMed: 'Sora_500Medium',
  body: 'AtkinsonHyperlegible_400Regular',
  bodyBold: 'AtkinsonHyperlegible_700Bold',
} as const;

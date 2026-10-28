// ShuttInk's under-the-sea look: deep water for headings and buttons,
// shallow aqua for the "water" areas at the top of screens, and warm sand
// and shell tones for the sheets and cards below the waves.
export const colors = {
  // Water, darkest to lightest
  deep: '#0A3D62', // primary buttons, big titles, dark modals
  abyss: '#14507A', // placeholders on dark modals
  ink: '#0B3049', // strong text
  text: '#2C5872', // body text
  muted: '#5B8299', // secondary text
  faint: '#7D9BAC', // hints, placeholders, inactive icons
  reef: '#0E86A8', // accent: links, active tabs, highlighted buttons
  reefDark: '#0B6E8C',
  reefBorder: '#A6DCEA',
  reefLight: '#DDF3F8',
  sea: '#BDE6EF', // shallow water behind screen headers
  seaDeep: '#8FD3E3', // wave crests and accents on the sea

  // Beach
  shell: '#F2E2C2', // sheets, cards and the tab bar (dry sand)
  sand: '#E8D3AA', // filled rows, chips, inputs (a shade darker than the sheet)
  sandLight: '#EEDCB8',
  sandBorder: '#D9BF8E',
  sandDark: '#C9AB78',

  coral: '#E8664A', // avatar initials and playful accents
  coralLight: '#FFE3D8',

  white: '#FFFFFF',
  sandTrack: 'rgba(242, 226, 194, 0.6)', // toggle tracks sitting on the sea
  backdrop: 'rgba(6, 40, 64, 0.5)', // behind bottom sheets
};

// Fredoka: rounded and bubbly. Custom fonts ignore fontWeight on Android,
// so each weight is its own family (see components/Themed.tsx).
export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
};

// Big playful headings: bold Fredoka with a solid drop shadow, like a
// sticker floating on the water. Spread into a style: { ...bubbly, fontSize }
export const bubbly = {
  fontFamily: fonts.bold,
  color: colors.deep,
  textShadowColor: colors.seaDeep,
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 0,
} as const;

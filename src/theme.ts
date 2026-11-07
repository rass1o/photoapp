// ShuttInk's look: quiet warm off-white paper and deep ink text, so the
// photos carry the color. Sea blue is for navigation (headers, tabs, links),
// coral is for the one main action on a screen, and the bright colors are
// saved for Ocho, prizes and celebrations.
export const colors = {
  // Water, darkest to lightest
  deep: '#0A3D62', // primary buttons, big titles, dark modals
  abyss: '#14507A', // placeholders on dark modals
  ink: '#14212B', // strong text
  text: '#2F3B45', // body text
  muted: '#66737D', // secondary text
  faint: '#98A2AA', // hints, placeholders, inactive icons
  reef: '#0E86A8', // accent: links, active tabs, highlighted buttons
  reefDark: '#0B6E8C',
  reefBorder: '#A6DCEA',
  reefLight: '#DDF3F8',
  sea: '#BDE6EF', // shallow water behind screen headers
  seaDeep: '#8FD3E3', // wave crests and accents on the sea

  // Paper (the names stay from the old sandy beach look)
  shell: '#FAF6EF', // sheets and cards: warm off-white
  sand: '#EFE8DC', // filled rows, chips, inputs (a shade darker than the sheet)
  sandLight: '#F4EFE6',
  sandBorder: '#E3D9C8',
  sandDark: '#CDBFA8',

  coral: '#E8664A', // the main action on each screen (Submit, Vote, Send)
  coralLight: '#FFE3D8',

  white: '#FFFFFF',
  sandTrack: 'rgba(250, 246, 239, 0.6)', // toggle tracks sitting on the sea

  // Film-camera date imprint: orange digits for stamps, counts and timers
  stamp: '#E2571B',
  stampGlow: 'rgba(255, 122, 40, 0.35)',
  backdrop: 'rgba(6, 40, 64, 0.5)', // behind bottom sheets
};

// Fredoka: rounded and bubbly. Custom fonts ignore fontWeight on Android,
// so each weight is its own family (see components/Themed.tsx).
export const fonts = {
  regular: 'Fredoka_400Regular',
  medium: 'Fredoka_500Medium',
  semibold: 'Fredoka_600SemiBold',
  bold: 'Fredoka_700Bold',
  // monospace, like the date a film camera prints in the corner of a photo
  stamp: 'ShareTechMono_400Regular',
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

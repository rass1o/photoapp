// ShuttInk's look: quiet warm off-white paper and deep ink text, so the
// photos carry the color. Sea blue is for navigation (headers, tabs, links),
// coral is for the one main action on a screen, and the bright colors are
// saved for Ocho, prizes and celebrations.
const lightColors = {
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

  white: '#FFFFFF', // text and icons on colored buttons, in both modes
  card: '#FFFFFF', // small white surfaces (badges, rows) that go dark in dark mode
  sandTrack: 'rgba(250, 246, 239, 0.6)', // toggle tracks sitting on the sea

  // Film-camera date imprint: orange digits for stamps, counts and timers
  stamp: '#E2571B',
  stampGlow: 'rgba(255, 122, 40, 0.35)',
  backdrop: 'rgba(6, 40, 64, 0.5)', // behind bottom sheets
};

// Dark mode: the same names, so every screen picks them up. Paper turns to
// deep-sea night, text turns light, and deep blue brightens so it still
// works both as a button color (white text on it) and as title text.
const darkColors: typeof lightColors = {
  deep: '#3A8DC4',
  abyss: '#0B2233',
  ink: '#E8EEF2',
  text: '#C5D0D8',
  muted: '#8E9CA6',
  faint: '#62717C',
  reef: '#2AA5C8',
  reefDark: '#5BC0DE',
  reefBorder: '#2A5A6C',
  reefLight: '#123342',
  sea: '#0F3247',
  seaDeep: '#1E5A7A',

  shell: '#121B22',
  sand: '#1C2830',
  sandLight: '#18232B',
  sandBorder: '#2A3843',
  sandDark: '#3A4B57',

  coral: '#E8664A',
  coralLight: '#4A2A22',

  white: '#FFFFFF',
  card: '#1C2830',
  sandTrack: 'rgba(18, 27, 34, 0.6)',

  stamp: '#E2571B',
  stampGlow: 'rgba(255, 122, 40, 0.35)',
  backdrop: 'rgba(0, 0, 0, 0.6)',
};

export type ColorMode = 'light' | 'dark';
export const COLOR_MODE_KEY = 'colorMode';

// The colors every screen uses. It starts light, and App.tsx switches it to
// dark (if that's the saved choice) before any screen loads, because screens
// read these once, when their styles are created. So changing the mode
// restarts the app (see setColorMode in SettingsScreen).
export const colors = { ...lightColors };

// Drawings (Ocho, sidekicks, frames, banners, the logo) keep their light
// colors in both modes, so they look the same everywhere
export const artColors: Readonly<typeof lightColors> = lightColors;

let currentMode: ColorMode = 'light';
export const colorMode = () => currentMode;
export const isDarkMode = () => currentMode === 'dark';

export function applyColorMode(mode: ColorMode) {
  currentMode = mode;
  Object.assign(colors, mode === 'dark' ? darkColors : lightColors);
  Object.assign(bubbly, bubblyFor());
}


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
const bubblyFor = () => ({
  fontFamily: fonts.bold,
  color: colors.deep,
  textShadowColor: colors.seaDeep,
  textShadowOffset: { width: 0, height: 2 },
  textShadowRadius: 0,
});
export const bubbly = bubblyFor();

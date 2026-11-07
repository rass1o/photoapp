import { StyleSheet, Text, TextProps } from 'react-native';
import { colors, fonts } from '../theme';

// Text in the film-camera date-imprint style: orange monospace digits with a
// faint glow. For film stamps, counts, dates and countdowns.
export default function Stamp({ style, ...props }: TextProps) {
  return <Text {...props} style={[styles.stamp, style]} />;
}

const styles = StyleSheet.create({
  stamp: {
    fontFamily: fonts.stamp,
    color: colors.stamp,
    fontSize: 13,
    letterSpacing: 0.6,
    textShadowColor: colors.stampGlow,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
});

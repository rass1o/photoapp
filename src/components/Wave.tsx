import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

export const WAVE_HEIGHT = 18;

// Water from the top edge down to a wavy shoreline
const WATER =
  'M0,0 L400,0 L400,8 C367,18 333,18 300,8 C267,-2 233,-2 200,8 C167,18 133,18 100,8 C67,-2 33,-2 0,8 Z';

// The header's water washing over the top of a sand sheet. Put it inside the
// sheet; it sits above the sheet's content, so anything that scrolls up
// slides under the curve of the water instead of a straight edge. Give the
// scrolling content about WAVE_HEIGHT of top padding so it starts clear.
export default function Wave({ water = colors.sea }: { water?: string }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height={WAVE_HEIGHT} viewBox={`0 0 400 ${WAVE_HEIGHT}`} preserveAspectRatio="none">
        {/* wet sand just past the waterline */}
        <Path d={WATER} fill={colors.seaDeep} opacity={0.45} transform="translate(0,3)" />
        <Path d={WATER} fill={water} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // Overlaps the header by a pixel so no seam shows between them
  wrap: { position: 'absolute', top: -1, left: 0, right: 0, height: WAVE_HEIGHT, zIndex: 2, elevation: 2 },
});

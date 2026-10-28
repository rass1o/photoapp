import { View, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

const HEIGHT = 18;

// Wavy top edge for a sheet: put it as the sheet's first child and it rises
// above the sheet, so the sea behind the header washes into the sand below.
export default function Wave({ color = colors.shell }: { color?: string }) {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Svg width="100%" height={HEIGHT} viewBox="0 0 400 18" preserveAspectRatio="none">
        <Path
          d="M0,10 C33,0 67,0 100,10 C133,20 167,20 200,10 C233,0 267,0 300,10 C333,20 367,20 400,10 L400,18 L0,18 Z"
          fill={colors.seaDeep}
          opacity={0.6}
          transform="translate(0,-4)"
        />
        <Path
          d="M0,10 C33,0 67,0 100,10 C133,20 167,20 200,10 C233,0 267,0 300,10 C333,20 367,20 400,10 L400,18 L0,18 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', top: -HEIGHT + 1, left: 0, right: 0, height: HEIGHT },
});

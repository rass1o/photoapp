import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Pattern, Rect } from 'react-native-svg';
import { colors } from '../theme';

const TILE = 56;

// Hand-placed specks for one tile: [x, y, radius, color, opacity]. Mixing
// darker grains with a few light ones reads as sand rather than dust.
const SPECKS: Array<[number, number, number, string, number]> = [
  [4, 6, 1.1, colors.sandDark, 0.55],
  [17, 2, 0.7, '#A8834F', 0.35],
  [29, 11, 1.3, colors.sandDark, 0.45],
  [44, 5, 0.8, colors.white, 0.6],
  [52, 19, 1, colors.sandDark, 0.5],
  [9, 21, 0.7, colors.white, 0.55],
  [22, 26, 1, '#A8834F', 0.3],
  [37, 23, 0.6, colors.sandDark, 0.6],
  [47, 34, 1.2, colors.sandDark, 0.4],
  [3, 38, 0.9, colors.sandDark, 0.5],
  [15, 44, 1.2, colors.white, 0.45],
  [28, 40, 0.7, colors.sandDark, 0.55],
  [34, 51, 1, '#A8834F', 0.35],
  [50, 48, 0.7, colors.white, 0.6],
  [8, 52, 0.6, colors.sandDark, 0.5],
  [41, 14, 0.5, '#A8834F', 0.4],
  [24, 16, 0.5, colors.white, 0.5],
];

// Speckled sand texture. Put it as the first child of a sand-coloured view.
export default function SandGrain() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="grain" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            {SPECKS.map(([cx, cy, r, fill, opacity], i) => (
              <Circle key={i} cx={cx} cy={cy} r={r} fill={fill} opacity={opacity} />
            ))}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grain)" />
      </Svg>
    </View>
  );
}

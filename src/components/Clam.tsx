import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { colors } from '../theme';

const OUTLINE = colors.abyss;
const SHELL = '#F7A99A';
const SHELL_DARK = '#E9857A';
const HINGE = { x: 60, y: 66 };

// Scallop fan: a ridged half-disc around the hinge, with a bump between
// each pair of ridges along the edge
function fanPath(radius: number, from: number, to: number, ribs: number) {
  const point = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return [HINGE.x + r * Math.cos(a), HINGE.y + r * Math.sin(a)];
  };
  const step = (to - from) / ribs;
  const [sx, sy] = point(from, radius);
  let d = `M${HINGE.x},${HINGE.y} L${sx.toFixed(1)},${sy.toFixed(1)}`;
  const ridges: string[] = [];
  for (let i = 1; i <= ribs; i++) {
    const [cx, cy] = point(from + step * (i - 0.5), radius + 7);
    const [ex, ey] = point(from + step * i, radius);
    d += ` Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
    if (i < ribs) ridges.push(`M${HINGE.x},${HINGE.y} L${ex.toFixed(1)},${ey.toFixed(1)}`);
  }
  return { outline: `${d} Z`, ridges };
}

const TOP = fanPath(46, 180, 360, 6); // upper shell, fans upward
const BOTTOM_BOWL = 'M14,66 Q16,100 60,100 Q104,100 106,66 Z';

// The blind box: a cartoon clam. Closed in the shop, open (pearl and
// sparkles) once you've cracked it.
export default function Clam({ size = 96, open = false }: { size?: number; open?: boolean }) {
  return (
    <Svg width={size} height={size * 0.92} viewBox="0 -20 120 124">
      {open && (
        <G>
          <Path d="M60,-14 L63,-6 L71,-4 L63,-1 L60,7 L57,-1 L49,-4 L57,-6 Z" fill="#FDE68A" />
          <Path d="M18,6 L20,11 L25,12 L20,14 L18,19 L16,14 L11,12 L16,11 Z" fill="#FDE68A" />
          <Path d="M102,6 L104,11 L109,12 L104,14 L102,19 L100,14 L95,12 L100,11 Z" fill="#FDE68A" />
        </G>
      )}

      <Path d={BOTTOM_BOWL} fill={SHELL_DARK} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />

      {open && (
        <G>
          <Ellipse cx={60} cy={70} rx={40} ry={8} fill="#B23A48" opacity={0.85} />
          <Circle cx={60} cy={63} r={11} fill="#FFF7F0" stroke={OUTLINE} strokeWidth={2.5} />
          <Circle cx={56} cy={59} r={3} fill={colors.white} />
        </G>
      )}

      {/* Lifted and tipped back when open */}
      <G transform={open ? 'translate(0,-22) rotate(-8 60 66)' : undefined}>
        <Path d={TOP.outline} fill={SHELL} stroke={OUTLINE} strokeWidth={3} strokeLinejoin="round" />
        {TOP.ridges.map((d, i) => (
          <Path key={i} d={d} stroke={SHELL_DARK} strokeWidth={2.5} strokeLinecap="round" />
        ))}
        <Ellipse cx={42} cy={38} rx={9} ry={5} fill={colors.white} opacity={0.4} rotation={-30} origin="42, 38" />
        <Path d="M50,66 Q60,58 70,66" fill={SHELL_DARK} stroke={OUTLINE} strokeWidth={2.5} />
      </G>

      {!open && (
        <G>
          {/* Closed: a peek of pearl glow at the lip and a little smile */}
          <Path d="M24,68 Q60,76 96,68" stroke="#FDE68A" strokeWidth={3} strokeLinecap="round" fill="none" />
          <Circle cx={46} cy={84} r={2.5} fill={OUTLINE} />
          <Circle cx={74} cy={84} r={2.5} fill={OUTLINE} />
          <Path d="M54,89 Q60,94 66,89" stroke={OUTLINE} strokeWidth={2.5} strokeLinecap="round" fill="none" />
        </G>
      )}
    </Svg>
  );
}

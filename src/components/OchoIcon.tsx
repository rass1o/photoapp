import Svg, { Circle, G, Path } from 'react-native-svg';

// ShuttInk's own icon set, drawn like Ocho: thick rounded strokes and soft
// corners. Each icon has an outline look and a filled look (for an active
// tab, or a heart you've liked). A few lean into the sea: the Shop is a clam,
// your profile is a tiny Ocho, comments are air bubbles, and sharing sends a
// paper boat.

export type OchoIconName =
  | 'home'
  | 'rankings'
  | 'camera'
  | 'shop'
  | 'profile'
  | 'heart'
  | 'vote'
  | 'comment'
  | 'share'
  | 'bell'
  | 'search'
  | 'more';

type Props = {
  name: OchoIconName;
  size?: number;
  color: string;
  filled?: boolean;
  // what shows through on a filled icon (eyes, door, lens...)
  detail?: string;
};

export default function OchoIcon({ name, size = 22, color, filled = false, detail = '#FFFFFF' }: Props) {
  const fill = filled ? color : 'none';
  const line = { stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const shape = { ...line, fill };
  // inner marks: dark lines on an outline icon, cut-outs on a filled one
  const inner = filled ? detail : color;

  let body;
  switch (name) {
    case 'home':
      // a little beach hut
      body = (
        <G>
          <Path d="M3.5,11.2 L12,4 L20.5,11.2" {...line} />
          <Path d="M5.5,10 V19 a1.5,1.5 0 0 0 1.5,1.5 H17 a1.5,1.5 0 0 0 1.5,-1.5 V10" {...shape} />
          <Path d="M10,20.5 V16 a2,2 0 0 1 4,0 V20.5" {...line} stroke={inner} />
        </G>
      );
      break;
    case 'rankings':
      body = (
        <G>
          <Path d="M7,4 H17 V8.5 a5,5 0 0 1 -10,0 Z" {...shape} />
          <Path d="M7,6 H4.8 a2.6,2.6 0 0 0 2.9,4.4 M17,6 H19.2 a2.6,2.6 0 0 1 -2.9,4.4" {...line} />
          <Path d="M12,13.5 V16.5 M8.5,20 H15.5 L14.6,16.5 H9.4 Z" {...shape} />
        </G>
      );
      break;
    case 'camera':
      body = (
        <G>
          <Path d="M3.5,9 a2,2 0 0 1 2,-2 H8 L9.5,4.8 H14.5 L16,7 H18.5 a2,2 0 0 1 2,2 V17.5 a2,2 0 0 1 -2,2 H5.5 a2,2 0 0 1 -2,-2 Z" {...shape} />
          <Circle cx={12} cy={13} r={3.6} {...line} stroke={inner} />
          <Circle cx={17.4} cy={10} r={0.6} fill={inner} />
        </G>
      );
      break;
    case 'shop':
      // a clam shell, ridges fanning out from the hinge
      body = (
        <G>
          <Path d="M3,15.5 C3,8 21,8 21,15.5 C21,18.4 17.2,20.5 12,20.5 C6.8,20.5 3,18.4 3,15.5 Z" {...shape} />
          <Path d="M12,20.5 V9.8 M12,20.5 L7.4,11 M12,20.5 L16.6,11 M12,20.5 L4.2,14 M12,20.5 L19.8,14" {...line} stroke={inner} strokeWidth={1.5} />
          <Path d="M9.5,20.5 h5" {...line} />
        </G>
      );
      break;
    case 'profile':
      // a tiny Ocho
      body = (
        <G>
          <Path d="M5.6,12.6 a6.4,6.4 0 1 1 12.8,0 C18.4,14.6 17.2,15.6 16,15.6 H8 C6.8,15.6 5.6,14.6 5.6,12.6 Z" {...shape} />
          <Path d="M7.6,15.6 q-0.6,3.4 -2.8,4.1 M10.6,15.6 q0.2,3 -1,4.6 M13.4,15.6 q-0.2,3 1,4.6 M16.4,15.6 q0.6,3.4 2.8,4.1" {...line} />
          <Circle cx={9.6} cy={10.8} r={1.1} fill={inner} />
          <Circle cx={14.4} cy={10.8} r={1.1} fill={inner} />
        </G>
      );
      break;
    case 'heart':
      body = (
        <Path
          d="M12,20 C5.5,15.6 3,12.6 3,9.2 C3,6.4 5.1,4.5 7.6,4.5 C9.5,4.5 11,5.6 12,7.2 C13,5.6 14.5,4.5 16.4,4.5 C18.9,4.5 21,6.4 21,9.2 C21,12.6 18.5,15.6 12,20 Z"
          {...shape}
        />
      );
      break;
    case 'vote':
      body = (
        <Path
          d="M12,3.6 L14.5,8.8 L20.1,9.5 L16,13.4 L17.1,19 L12,16.3 L6.9,19 L8,13.4 L3.9,9.5 L9.5,8.8 Z"
          {...shape}
        />
      );
      break;
    case 'comment':
      // an air bubble with a little tail and a shine
      body = (
        <G>
          <Path d="M12,4 a8,7.4 0 1 1 -4.4,13.6 L4,19.6 L5.2,15.6 A7.4,7.4 0 0 1 12,4 Z" {...shape} />
          <Path d="M8,9.2 a4.6,4.6 0 0 1 3.4,-2.4" {...line} stroke={inner} strokeWidth={1.6} />
        </G>
      );
      break;
    case 'share':
      // a paper boat
      body = (
        <G>
          <Path d="M3,14.5 H21 L18,19.5 H6 Z" {...shape} />
          <Path d="M12,14.5 V4.5 L18.2,13 M12,6 L6.5,13" {...line} />
        </G>
      );
      break;
    case 'bell':
      body = (
        <G>
          <Path d="M6,16.5 V11 a6,6 0 0 1 12,0 V16.5 L19.5,18 H4.5 Z" {...shape} />
          <Path d="M10,20.5 a2.2,2.2 0 0 0 4,0" {...line} />
        </G>
      );
      break;
    case 'search':
      body = (
        <G>
          <Circle cx={10.5} cy={10.5} r={6} {...shape} />
          <Path d="M15,15 L20,20" {...line} strokeWidth={2.6} />
          <Path d="M7.6,9 a3.2,3.2 0 0 1 2.4,-2" {...line} stroke={inner} strokeWidth={1.5} />
        </G>
      );
      break;
    case 'more':
      body = (
        <G fill={color}>
          <Circle cx={5.5} cy={12} r={1.9} />
          <Circle cx={12} cy={12} r={1.9} />
          <Circle cx={18.5} cy={12} r={1.9} />
        </G>
      );
      break;
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {body}
    </Svg>
  );
}

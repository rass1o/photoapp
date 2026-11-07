// Shared shapes for the legendary scenes (AnimatedBanner moves the same ones)

// The koi pond: two koi swimming round one oval. Where each one starts (in
// radians round the oval) is shared, so the still banner and the moving one
// line up and the fish don't jump when it starts moving.
export const KOI_POND = {
  cx: 200,
  cy: 130,
  rx: 160,
  ry: 70,
  orange: 2.4, // bottom left
  white: 2.4 - Math.PI, // top right, across from it
};

// Where a koi is at angle a, and which way it's facing (radians), so it
// always swims nose first
export function koiPose(a: number) {
  'worklet';
  return {
    x: KOI_POND.cx + KOI_POND.rx * Math.cos(a),
    y: KOI_POND.cy + KOI_POND.ry * Math.sin(a),
    heading: Math.atan2(KOI_POND.ry * Math.cos(a), -KOI_POND.rx * Math.sin(a)),
  };
}
export const CAT = {
  body: 'M0,0 C-4,-22 40,-30 64,-16 C72,-10 72,-2 66,0 Z',
  tail: 'M2,-4 C-16,-4 -22,-18 -12,-24',
  head: 'M64,-10 C64,-24 88,-26 90,-12 C92,0 66,2 64,-10 Z',
  ears: 'M66,-20 L66,-32 L74,-24 Z M80,-24 L88,-34 L88,-20 Z',
  sleepy: 'M72,-14 Q75,-11 78,-14 M82,-14 Q85,-11 88,-14',
  // Merlin's face, the same as on his frame: pink inner ears and nose, pale whiskers
  innerEars: 'M67.5,-22.5 L67.5,-29 L71.5,-24.5 Z M82.5,-23.5 L86.5,-30 L86.5,-21.5 Z',
  nose: 'M78.6,-9.6 L81.4,-9.6 L80,-7.8 Z',
  whiskers: 'M76,-8.5 L67,-9.5 M76,-7 L67.5,-5 M84,-8.5 L93,-9.5 M84,-7 L92.5,-5',
  // pink collar round the neck, with a little gold bell
  collar: 'M62,-21 Q58,-10 64,-1',
  bell: { x: 61, y: -6, r: 2.6 },
};

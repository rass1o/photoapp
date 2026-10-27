import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

// Stamp colors live in shop_items.accent; fetch them once per app session
let accentCache: Map<string, string> | null = null;
let accentRequest: Promise<Map<string, string>> | null = null;

function fetchAccents() {
  if (!accentRequest) {
    accentRequest = Promise.resolve(
      supabase.from('shop_items').select('value, accent').eq('category', 'stamp')
    ).then(({ data }) => {
      accentCache = new Map((data ?? []).map((r) => [r.value, r.accent ?? '#374151']));
      return accentCache;
    });
  }
  return accentRequest;
}

function useStampAccent(stock: string) {
  const [accent, setAccent] = useState(accentCache?.get(stock));
  useEffect(() => {
    if (accentCache) return;
    fetchAccents().then((map) => setAccent(map.get(stock)));
  }, [stock]);
  return accent ?? '#374151';
}

// Light accents (yellows) get dark text so the label stays readable
function textColorFor(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
}

type Props = {
  stock: string;
  accent?: string | null; // pass when already known (e.g. in the shop) to skip the lookup
  size?: 'small' | 'regular';
};

export default function FilmStamp({ stock, accent, size = 'regular' }: Props) {
  const looked = useStampAccent(stock);
  const color = accent ?? looked;
  const textColor = textColorFor(color);
  const small = size === 'small';

  return (
    <View style={[styles.stamp, small && styles.stampSmall, { backgroundColor: color }]}>
      <View style={[styles.sprockets, { borderColor: textColor }]} />
      <Ionicons name="film" size={small ? 10 : 12} color={textColor} />
      <Text style={[styles.text, small && styles.textSmall, { color: textColor }]} numberOfLines={1}>
        {stock}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  stampSmall: { paddingHorizontal: 6, paddingVertical: 3, gap: 3 },
  // Dashed top edge reads as film sprocket holes
  sprockets: {
    position: 'absolute',
    top: 1,
    left: 2,
    right: 2,
    borderTopWidth: 1.5,
    borderStyle: 'dashed',
    opacity: 0.45,
  },
  text: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  textSmall: { fontSize: 10 },
});

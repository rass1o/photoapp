import { View, StyleSheet, Pressable, Image, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { OchoShield, OchoStudy } from './OchoArt';
import { useModeration, type CoverKind } from '../context/ModerationContext';
import { colors, bubbly, fonts } from '../theme';

// What shows in place of a reported or hidden photo (Ocho with his
// magnifying glass), and in place of a blocked account (Ocho with a shield).

const PHOTO_COPY: Record<CoverKind, { title: string; body: string }> = {
  reported: {
    title: 'Ocho is studying this photo',
    body: 'Thanks for reporting it. It stays covered for you, and we’ll keep you updated.',
  },
  hidden: {
    title: 'Ocho is studying this photo',
    body: 'A few people reported it, so it’s hidden while we take a look.',
  },
  mine: {
    title: 'Your photo is being reviewed',
    body: 'A few people reported it, so it’s hidden while Ocho takes a look. We’ll keep you updated.',
  },
  blocked: {
    title: 'From someone you blocked',
    body: 'Ocho is keeping this one away from you.',
  },
};

type CoverProps = {
  kind: CoverKind;
  // Thumbnails just get Ocho and a tag, no text
  compact?: boolean;
  noun?: 'photo' | 'comment';
};

// Lay it over the image (it fills its parent)
export function ReviewCover({ kind, compact = false, noun = 'photo' }: CoverProps) {
  if (compact) {
    return (
      <View style={[StyleSheet.absoluteFill, styles.cover, styles.compact]} pointerEvents="none">
        {kind === 'blocked' ? <OchoShield size={38} /> : <OchoStudy size={42} />}
      </View>
    );
  }
  const copy = PHOTO_COPY[kind];
  return (
    <View style={[StyleSheet.absoluteFill, styles.cover]}>
      {kind === 'blocked' ? <OchoShield size={96} /> : <OchoStudy size={110} />}
      <Text style={styles.title}>{noun === 'comment' ? copy.title.replace('photo', 'comment') : copy.title}</Text>
      <Text style={styles.body}>{noun === 'comment' ? copy.body.replace('photo', 'comment') : copy.body}</Text>
    </View>
  );
}

// A photo thumbnail that covers itself if it's reported, hidden or from
// someone you blocked. Tiny ones (rankings rows) just get an icon.
export function CoverableImage({
  uri,
  id,
  ownerId,
  style,
  tiny = false,
}: {
  uri: string;
  id: string;
  ownerId: string | null | undefined;
  style: StyleProp<ViewStyle>;
  tiny?: boolean;
}) {
  const { coverFor } = useModeration();
  const cover = coverFor(id, ownerId);
  return (
    <View style={[style, styles.clip]}>
      <Image source={{ uri }} style={StyleSheet.absoluteFill} />
      {cover &&
        (tiny ? (
          <View style={[StyleSheet.absoluteFill, styles.cover, styles.compact]}>
            <Ionicons name={cover === 'blocked' ? 'shield' : 'search'} size={16} color={colors.abyss} />
          </View>
        ) : (
          <ReviewCover kind={cover} compact />
        ))}
    </View>
  );
}

// A reported comment, in the comment list
export function CoveredComment({ kind }: { kind: CoverKind }) {
  return (
    <View style={styles.commentRow}>
      <Ionicons name="search" size={14} color={colors.faint} />
      <Text style={styles.commentText}>
        {kind === 'mine' ? 'Your comment is being reviewed.' : 'Ocho is studying this comment.'}
      </Text>
    </View>
  );
}

// Fills a blocked person's profile
export function BlockedCover({ username, onUnblock }: { username: string; onUnblock: () => void }) {
  return (
    <View style={styles.blocked}>
      <OchoShield size={170} />
      <Text style={styles.blockedTitle}>You blocked {username}</Text>
      <Text style={styles.blockedBody}>
        Ocho’s standing guard. Their photos, comments and notifications stay away from you, and they can’t send you
        friend requests. They haven’t been told.
      </Text>
      <Pressable style={styles.unblock} onPress={onUnblock}>
        <Ionicons name="lock-open-outline" size={16} color={colors.deep} />
        <Text style={styles.unblockText}>Unblock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    backgroundColor: colors.sandLight,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderWidth: 2,
    borderColor: colors.sandBorder,
    borderStyle: 'dashed',
  },
  compact: { padding: 0, borderWidth: 0 },
  clip: { overflow: 'hidden' },
  title: { ...bubbly, fontSize: 18, textAlign: 'center', marginTop: 4 },
  body: { fontSize: 13, color: colors.text, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 280 },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  commentText: { fontSize: 13, color: colors.faint, fontStyle: 'italic' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  blockedTitle: { ...bubbly, fontSize: 24, textAlign: 'center', marginTop: 8 },
  blockedBody: { fontSize: 14, color: colors.text, textAlign: 'center', lineHeight: 20, marginTop: 8, maxWidth: 320 },
  unblock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 22,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: colors.deep,
  },
  unblockText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.deep },
});

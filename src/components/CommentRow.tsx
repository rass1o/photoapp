import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Themed';
import { CoveredComment } from './ModerationCovers';
import { useModeration } from '../context/ModerationContext';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, fonts } from '../theme';

// One comment in a photo's comment list. Tap the name to open their profile,
// Reply to answer them, and Delete if it's yours or it's on your photo.
// Press and hold someone else's comment to report it or block them.

export type CommentItem = {
  id: string;
  user_id: string;
  username: string;
  body: string;
  parent_id: string | null;
};

// Each comment followed by its replies (oldest first in both), dropping
// anything from people you've blocked
export function threadComments<T extends CommentItem>(comments: T[], isBlocked: (id: string) => boolean) {
  const visible = comments.filter((c) => !isBlocked(c.user_id));
  const ids = new Set(visible.map((c) => c.id));
  const out: Array<T & { isReply: boolean }> = [];
  for (const c of visible) {
    // a reply whose comment is gone (or hidden) shows on its own
    if (c.parent_id && ids.has(c.parent_id)) continue;
    out.push({ ...c, isReply: false });
    for (const r of visible) if (r.parent_id === c.id) out.push({ ...r, isReply: true });
  }
  return out;
}

// Every comment that goes away when this one is deleted (it plus its replies)
export function removedWith(comments: CommentItem[], id: string) {
  return new Set([id, ...comments.filter((c) => c.parent_id === id).map((c) => c.id)]);
}

type Props = {
  comment: CommentItem;
  isReply: boolean;
  photoOwnerId: string | null | undefined;
  onOpenProfile: (userId: string) => void;
  onReply: (comment: CommentItem) => void;
  onDeleted: (comment: CommentItem) => void;
  // close a surrounding sheet before the report sheet opens
  beforeReport?: () => void;
  // side padding (0 inside a sheet that has its own)
  inset?: number;
};

export default function CommentRow({ comment, isReply, photoOwnerId, onOpenProfile, onReply, onDeleted, beforeReport, inset = 16 }: Props) {
  const { user } = useAuth();
  const moderation = useModeration();
  const cover = moderation.coverFor(comment.id, comment.user_id);
  const mine = comment.user_id === user?.id;
  const canDelete = mine || (!!user && photoOwnerId === user.id);

  const remove = () =>
    Alert.alert(
      'Delete this comment?',
      mine ? 'Its replies will be deleted too.' : `${comment.username}’s comment and its replies will be removed from your photo.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('delete_comment', { p_comment: comment.id });
            if (error) Alert.alert('Couldn’t delete it', error.message);
            else onDeleted(comment);
          },
        },
      ]
    );

  const openMenu = () => {
    if (mine) return remove();
    const report = { kind: 'comment' as const, id: comment.id, userId: comment.user_id, username: comment.username };
    if (!canDelete) return moderation.openContentMenu(report, beforeReport);
    // on your own photo you can also delete it
    Alert.alert(`${comment.username}’s comment`, undefined, [
      { text: 'Delete comment', style: 'destructive', onPress: remove },
      { text: 'Report or block', onPress: () => moderation.openContentMenu(report, beforeReport) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Pressable style={[styles.row, { paddingHorizontal: inset }, isReply && styles.reply]} onLongPress={openMenu} delayLongPress={350}>
      <Pressable onPress={() => onOpenProfile(comment.user_id)} hitSlop={4} style={styles.nameWrap}>
        <Text style={styles.username}>{comment.username}</Text>
      </Pressable>
      {cover ? <CoveredComment kind={cover} /> : <Text style={styles.body}>{comment.body}</Text>}
      {!cover && (
        <View style={styles.actions}>
          <Pressable onPress={() => onReply(comment)} hitSlop={8}>
            <Text style={styles.action}>Reply</Text>
          </Pressable>
          {canDelete && (
            <Pressable onPress={remove} hitSlop={8}>
              <Text style={[styles.action, styles.delete]}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

// Sits above the comment box while you're replying to someone
export function ReplyingTo({ username, onCancel }: { username: string; onCancel: () => void }) {
  return (
    <View style={styles.replying}>
      <Text style={styles.replyingText}>
        Replying to <Text style={styles.replyingName}>{username}</Text>
      </Text>
      <Pressable onPress={onCancel} hitSlop={10}>
        <Text style={styles.action}>Cancel</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  replying: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.sand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 10,
  },
  replyingText: { fontSize: 13, color: colors.muted },
  replyingName: { fontFamily: fonts.semibold, color: colors.ink },
  row: { paddingVertical: 8 },
  reply: { marginLeft: 22, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.sandBorder },
  nameWrap: { alignSelf: 'flex-start' },
  username: { fontFamily: fonts.semibold, fontSize: 13, color: colors.ink },
  body: { fontSize: 14, color: colors.text, lineHeight: 19, marginTop: 1 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 4 },
  action: { fontFamily: fonts.semibold, fontSize: 12, color: colors.muted },
  delete: { color: '#B91C1C' },
});

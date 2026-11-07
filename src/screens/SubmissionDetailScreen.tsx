import { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import FilmStamp from '../components/FilmStamp';
import FormatTag from '../components/FormatTag';
import BackBar from '../components/BackBar';
import ShareCardModal from '../components/ShareCardModal';
import VoteSheet from '../components/VoteSheet';
import { useThemeVotes } from '../lib/voting';
import { useLikes } from '../lib/likes';
import { formatTimeLeft, themePhase } from '../lib/themes';
import { frameColor } from '../components/AvatarFrame';
import SandGrain from '../components/SandGrain';
import OchoLoader from '../components/OchoLoader';
import OchoIcon from '../components/OchoIcon';
import Stamp from '../components/Stamp';
import FilmFrame from '../components/FilmFrame';
import { BlockedCover, ReviewCover } from '../components/ModerationCovers';
import CommentRow, { CommentItem, ReplyingTo, removedWith, threadComments } from '../components/CommentRow';
import { useModeration } from '../context/ModerationContext';
import { Text, TextInput } from '../components/Themed';
import { colors } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmissionDetail'>;

type Submission = {
  id: string;
  user_id: string;
  theme_id: string;
  image_url: string;
  format: 'digital' | 'film';
  vote_count: number;
  like_count: number;
  caption: string;
  film_stamp: string | null;
  film_strip: boolean;
  username: string;
  avatar_url: string | null;
  avatar_frame_color: string;
};

type Comment = {
  id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  username: string;
};

export default function SubmissionDetailScreen({ route, navigation }: Props) {
  const { submissionId } = route.params;
  const { user } = useAuth();

  const [sharing, setSharing] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [themeEnd, setThemeEnd] = useState<string | null>(null);
  const [voteSheetOpen, setVoteSheetOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; parent_id: string | null; username: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);

  const load = async () => {
    const { data: subData, error } = await supabase
      .from('submissions')
      .select('id, user_id, theme_id, image_url, format, vote_count, like_count, caption, film_stamp, film_strip')
      .eq('id', submissionId)
      .single();

    if (error || !subData) {
      setIsLoading(false);
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('username, avatar_url, avatar_frame_color')
      .eq('id', subData.user_id)
      .single();

    setSubmission({
      ...subData,
      username: profileData?.username ?? 'unknown',
      avatar_url: profileData?.avatar_url ?? null,
      avatar_frame_color: profileData?.avatar_frame_color ?? '#7c3aed',
    });

    const { data: themeRow } = await supabase.from('themes').select('end_date').eq('id', subData.theme_id).maybeSingle();
    setThemeEnd(themeRow?.end_date ?? null);

    const { data: commentRows } = await supabase
      .from('comments')
      .select('id, user_id, body, parent_id')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const rows = commentRows ?? [];
    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }
    setComments(rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' })));
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, [submissionId]);

  const moderation = useModeration();
  const visibleComments = threadComments(comments, moderation.isBlocked);

  const phase = themePhase(themeEnd);
  const likes = useLikes(user?.id, (_id, delta) =>
    setSubmission((prev) => (prev ? { ...prev, like_count: prev.like_count + delta } : prev))
  );
  const toggleLike = () => {
    if (!user || !submission) return;
    if (submission.user_id === user.id) {
      Alert.alert('That\u2019s your photo', 'Your friends can like it, though!');
      return;
    }
    if (phase === 'ended') return;
    likes.toggle(submission.id);
  };
  const liked = !!submission && likes.liked.has(submission.id);
  const votes = useThemeVotes(submission?.theme_id, user?.id, (from, to) =>
    setSubmission((prev) =>
      prev ? { ...prev, vote_count: prev.vote_count + (to === prev.id ? 1 : 0) - (from === prev.id ? 1 : 0) } : prev
    )
  );
  const overallHere = !!submission && votes.mine.overall === submission.id;
  const picksHere = submission
    ? Object.entries(votes.mine).filter(([c, id]) => c !== 'overall' && id === submission.id).length
    : 0;

  const openVoting = () => {
    if (!user || !submission) return;
    if (submission.user_id === user.id) {
      Alert.alert('That\u2019s your photo', 'You can\u2019t vote for your own photo, but your friends can!');
      return;
    }
    if (phase === 'submit') {
      Alert.alert('Voting day is coming', 'Voting happens on the last day of each theme.');
      return;
    }
    if (phase === 'ended') {
      Alert.alert('Voting\u2019s over', 'This theme has ended. Check Rankings for the winners.');
      return;
    }
    setVoteSheetOpen(true);
  };

  const postComment = async () => {
    if (!user || !commentInput.trim()) return;
    const body = commentInput.trim();
    setCommentInput('');
    // replies join the thread of the comment they answer
    const parentId = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
    setReplyTo(null);

    const { data, error } = await supabase
      .from('comments')
      .insert({ submission_id: submissionId, user_id: user.id, body, parent_id: parentId })
      .select('id, user_id, body, parent_id')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, { ...data, username: user.username }]);
    }
  };

  const startReply = (c: CommentItem) => {
    setReplyTo({ id: c.id, parent_id: c.parent_id, username: c.username });
    setCommentInput(`@${c.username} `);
  };

  // Your own Film photo: show it in a film strip or not
  const toggleFilmStrip = async () => {
    if (!submission) return;
    const on = !submission.film_strip;
    setSubmission({ ...submission, film_strip: on });
    const { error } = await supabase.rpc('set_film_strip', { p_submission: submission.id, p_on: on });
    if (error) {
      setSubmission({ ...submission, film_strip: !on });
      Alert.alert('Couldn’t change that', error.message);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <BackBar />
        <View style={styles.centered}>
          <OchoLoader message="Ocho is fetching this photo…" />
        </View>
      </SafeAreaView>
    );
  }

  if (!submission) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <BackBar />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>This photo couldn't be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (moderation.isBlocked(submission.user_id)) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <BackBar />
        <BlockedCover
          username={submission.username}
          onUnblock={() => moderation.confirmUnblock(submission.user_id, submission.username)}
        />
      </SafeAreaView>
    );
  }

  const cover = moderation.coverFor(submission.id, submission.user_id);
  const isMine = submission.user_id === user?.id;

  return (
    <SafeAreaView style={styles.page} edges={['top']}>
      <SandGrain />
      <BackBar />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <FlatList
        style={styles.flex}
        data={visibleComments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View>
            <Pressable
              style={styles.userRow}
              onPress={() => navigation.push('UserProfile', { userId: submission.user_id })}
            >
              <View style={[styles.avatar, { borderColor: frameColor(submission.avatar_frame_color) }]}>
                {submission.avatar_url && (
                  <Image source={{ uri: submission.avatar_url }} style={styles.avatarImage} />
                )}
              </View>
              <Text style={styles.username}>{submission.username}</Text>
              <FormatTag format={submission.format} />
              {isMine && submission.format === 'film' && (
                <Pressable
                  style={styles.menuButton}
                  hitSlop={10}
                  onPress={() =>
                    Alert.alert('Your photo', undefined, [
                      { text: submission.film_strip ? 'Hide the film strip' : 'Show in a film strip', onPress: toggleFilmStrip },
                      { text: 'Cancel', style: 'cancel' },
                    ])
                  }
                >
                  <OchoIcon name="more" size={22} color={colors.muted} />
                </Pressable>
              )}
              {!isMine && (
                <Pressable
                  style={styles.menuButton}
                  hitSlop={10}
                  onPress={() =>
                    moderation.openContentMenu({
                      kind: 'photo',
                      id: submission.id,
                      userId: submission.user_id,
                      username: submission.username,
                    })
                  }
                >
                  <OchoIcon name="more" size={22} color={colors.muted} />
                </Pressable>
              )}
            </Pressable>

            <View style={styles.photoWrap}>
              <FilmFrame film={submission.format === 'film' && submission.film_strip} frame="1A">
                <Image
                  source={{ uri: submission.image_url }}
                  style={[styles.image, { aspectRatio }]}
                  onLoad={(e) => {
                    const { width, height } = e.nativeEvent.source;
                    if (width && height) {
                      setAspectRatio(Math.min(Math.max(width / height, 0.5), 2));
                    }
                  }}
                />
              </FilmFrame>
              {submission.film_stamp && (
                <View style={[styles.stampOverlay, submission.format === 'film' && submission.film_strip && styles.stampOverlayFilm]} pointerEvents="none">
                  <FilmStamp stock={submission.film_stamp} />
                </View>
              )}
              {cover && <ReviewCover kind={cover} />}
            </View>

            <View style={styles.actionsRow}>
              <Pressable style={styles.actionItem} onPress={toggleLike}>
                <OchoIcon name="heart" size={24} color={liked ? colors.coral : colors.text} filled={liked} />
                <Stamp style={styles.actionCount}>{submission.like_count}</Stamp>
              </Pressable>
              <Pressable style={styles.actionItem} onPress={openVoting}>
                <OchoIcon
                  name="vote"
                  size={24}
                  color={overallHere || picksHere > 0 ? colors.coral : colors.text}
                  filled={overallHere}
                />
                <Text style={[styles.actionText, (overallHere || picksHere > 0) && styles.actionTextActive]}>
                  {phase === 'vote'
                    ? overallHere || picksHere > 0
                      ? `${(overallHere ? 1 : 0) + picksHere} of your votes`
                      : 'Vote'
                    : phase === 'ended'
                      ? `${submission.vote_count} votes`
                      : 'Voting on the last day'}
                </Text>
              </Pressable>
              <Pressable style={styles.actionItem} onPress={() => setSharing(true)} hitSlop={6}>
                <OchoIcon name="share" size={24} color={colors.text} />
              </Pressable>
            </View>

            {submission.caption ? (
              <Text style={styles.caption}>
                <Text style={styles.captionUsername}>{submission.username}</Text> {submission.caption}
              </Text>
            ) : null}

            <Text style={styles.commentsHeader}>Comments</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No comments yet. Don't be shellfish, say something nice.</Text>}
        renderItem={({ item }) => (
          <CommentRow
            comment={item}
            isReply={item.isReply}
            photoOwnerId={submission.user_id}
            onOpenProfile={(userId) => navigation.push('UserProfile', { userId })}
            onReply={startReply}
            onDeleted={(c) => {
              const gone = removedWith(comments, c.id);
              setComments((prev) => prev.filter((x) => !gone.has(x.id)));
            }}
          />
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

      {replyTo && (
        <View style={styles.replyingWrap}>
          <ReplyingTo
            username={replyTo.username}
            onCancel={() => {
              setReplyTo(null);
              setCommentInput('');
            }}
          />
        </View>
      )}
      <View style={styles.commentInputRow}>
        <TextInput
          style={styles.commentInput}
          placeholder={replyTo ? `Reply to ${replyTo.username}` : 'Add a comment'}
          value={commentInput}
          onChangeText={setCommentInput}
        />
        <Pressable style={styles.commentSendButton} onPress={postComment}>
          <Ionicons name="send" size={16} color={colors.white} />
        </Pressable>
      </View>
      </KeyboardAvoidingView>
      <VoteSheet
        submissionId={voteSheetOpen ? submission.id : null}
        username={submission.username}
        categories={votes.categories}
        mine={votes.mine}
        timeLeft={themeEnd ? formatTimeLeft(new Date(themeEnd).getTime() - Date.now()) : ''}
        onToggle={votes.toggle}
        onClose={() => setVoteSheetOpen(false)}
      />
      <ShareCardModal
        visible={sharing}
        imageUrl={submission.image_url}
        username={submission.username}
        onClose={() => setSharing(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.shell },
  page: { flex: 1, backgroundColor: colors.shell },
  stampOverlay: { position: 'absolute', left: 10, bottom: 10 },
  stampOverlayFilm: { left: 14, bottom: 25 },
  photoWrap: { marginHorizontal: 6 },
  replyingWrap: { paddingHorizontal: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.shell },
  emptyText: { color: colors.faint, fontSize: 13, textAlign: 'center', padding: 20 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  menuButton: { marginLeft: 'auto', paddingHorizontal: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.coralLight, borderWidth: 2, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  username: { fontSize: 15, fontWeight: '600', color: colors.ink },

  image: { width: '100%', borderRadius: 5, backgroundColor: colors.sand },

  actionsRow: { flexDirection: 'row', gap: 22, padding: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 15, color: colors.text },
  actionTextActive: { color: colors.coral, fontWeight: '600' },
  actionCount: { fontSize: 15 },
  caption: { fontSize: 14, color: colors.text, paddingHorizontal: 16, paddingBottom: 12, lineHeight: 19 },
  captionUsername: { fontWeight: '600', color: colors.ink },

  commentsHeader: { fontSize: 13, fontWeight: '600', color: colors.muted, paddingHorizontal: 16, marginBottom: 4 },
  commentRow: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: colors.sand },
  commentUsername: { fontSize: 12, fontWeight: '600', color: colors.text },
  commentBody: { fontSize: 14, color: colors.ink, marginTop: 2 },

  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: colors.sand,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.sand,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  commentSendButton: { backgroundColor: colors.coral, borderRadius: 20, padding: 10 },
});
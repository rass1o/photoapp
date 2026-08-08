import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Share,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Theme = {
  id: string;
  name: string;
  end_date: string;
};

type Submission = {
  id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  vote_count: number;
  created_at: string;
  username: string;
};

type Comment = {
  id: string;
  submission_id: string;
  user_id: string;
  body: string;
  created_at: string;
  username: string;
};

type Notification = {
  id: string;
  voterUsername: string;
  imageUrl: string;
  createdAt: string;
};

function formatCountdown(endDate: string): string {
  const msLeft = new Date(endDate).getTime() - Date.now();
  if (msLeft <= 0) return 'Voting closed';
  const days = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((msLeft / (1000 * 60 * 60)) % 24);
  return `Voting ends in ${days}d ${hours}h`;
}

const DOUBLE_TAP_WINDOW_MS = 300;

export default function HomeScreen() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [pendingVoteIds, setPendingVoteIds] = useState<Set<string>>(new Set());
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSubmittedThisTheme, setHasSubmittedThisTheme] = useState(false);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [notifVisible, setNotifVisible] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);

  const [commentSubmissionId, setCommentSubmissionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [burstId, setBurstId] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});

  const loadData = useCallback(async (selectedFormat: 'digital' | 'film') => {
    setErrorMessage(null);

    const nowIso = new Date().toISOString();
    const { data: themeData, error: themeError } = await supabase
      .from('themes')
      .select('id, name, end_date')
      .lte('start_date', nowIso)
      .gte('end_date', nowIso)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (themeError) {
      setErrorMessage(themeError.message);
      return;
    }

    setTheme(themeData);

    if (!themeData) {
      setSubmissions([]);
      setHasSubmittedThisTheme(false);
      return;
    }

    if (user) {
      const { data: mine } = await supabase
        .from('submissions')
        .select('id')
        .eq('theme_id', themeData.id)
        .eq('user_id', user.id)
        .maybeSingle();
      setHasSubmittedThisTheme(!!mine);
    }

    const { data: submissionsData, error: submissionsError } = await supabase
      .from('submissions')
      .select('id, user_id, image_url, format, vote_count, created_at')
      .eq('theme_id', themeData.id)
      .eq('format', selectedFormat)
      .order('created_at', { ascending: false });

    if (submissionsError) {
      setErrorMessage(submissionsError.message);
      return;
    }

    const rows = submissionsData ?? [];

    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }

    setSubmissions(
      rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' }))
    );

    if (rows.length > 0) {
      const { data: commentRows } = await supabase
        .from('comments')
        .select('submission_id')
        .in('submission_id', rows.map((r) => r.id));
      const counts: Record<string, number> = {};
      (commentRows ?? []).forEach((c) => {
        counts[c.submission_id] = (counts[c.submission_id] ?? 0) + 1;
      });
      setCommentCounts(counts);
    } else {
      setCommentCounts({});
    }

    if (user && rows.length > 0) {
      const { data: voteRows } = await supabase
        .from('votes')
        .select('submission_id')
        .eq('user_id', user.id)
        .in('submission_id', rows.map((s) => s.id));
      setVotedIds(new Set((voteRows ?? []).map((v) => v.submission_id)));
    } else {
      setVotedIds(new Set());
    }
  }, [user]);

  useEffect(() => {
    setIsLoading(true);
    loadData(format).finally(() => setIsLoading(false));
  }, [format, loadData]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData(format);
    setIsRefreshing(false);
  };

  const castVote = useCallback(
    async (submissionId: string) => {
      if (!user || pendingVoteIds.has(submissionId) || votedIds.has(submissionId)) return;

      setPendingVoteIds((prev) => new Set(prev).add(submissionId));
      setVotedIds((prev) => new Set(prev).add(submissionId));
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, vote_count: s.vote_count + 1 } : s))
      );

      const { error } = await supabase
        .from('votes')
        .insert({ user_id: user.id, submission_id: submissionId });

      if (error) {
        setVotedIds((prev) => {
          const next = new Set(prev);
          next.delete(submissionId);
          return next;
        });
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? { ...s, vote_count: s.vote_count - 1 } : s))
        );
        console.log('Vote failed:', error.message);
      }

      setPendingVoteIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    },
    [user, votedIds, pendingVoteIds]
  );

  const removeVote = useCallback(
    async (submissionId: string) => {
      if (!user || pendingVoteIds.has(submissionId)) return;

      setPendingVoteIds((prev) => new Set(prev).add(submissionId));
      setVotedIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
      setSubmissions((prev) =>
        prev.map((s) => (s.id === submissionId ? { ...s, vote_count: s.vote_count - 1 } : s))
      );

      const { error } = await supabase
        .from('votes')
        .delete()
        .eq('user_id', user.id)
        .eq('submission_id', submissionId);

      if (error) {
        setVotedIds((prev) => new Set(prev).add(submissionId));
        setSubmissions((prev) =>
          prev.map((s) => (s.id === submissionId ? { ...s, vote_count: s.vote_count + 1 } : s))
        );
        console.log('Unvote failed:', error.message);
      }

      setPendingVoteIds((prev) => {
        const next = new Set(prev);
        next.delete(submissionId);
        return next;
      });
    },
    [user, pendingVoteIds]
  );

  const handleHeartTap = (submissionId: string) => {
    votedIds.has(submissionId) ? removeVote(submissionId) : castVote(submissionId);
  };

  const handleImageTap = (submissionId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[submissionId] ?? 0;
    if (now - lastTap < DOUBLE_TAP_WINDOW_MS) {
      castVote(submissionId);
      setBurstId(submissionId);
      setTimeout(() => setBurstId((current) => (current === submissionId ? null : current)), 700);
    }
    lastTapRef.current[submissionId] = now;
  };

  const openComments = async (submissionId: string) => {
    setCommentSubmissionId(submissionId);
    setCommentsLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('id, submission_id, user_id, body, created_at')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const rows = data ?? [];
    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }
    setComments(rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' })));
    setCommentsLoading(false);
  };

  const postComment = async () => {
    if (!user || !commentSubmissionId || !commentInput.trim()) return;
    const body = commentInput.trim();
    setCommentInput('');

    const { data, error } = await supabase
      .from('comments')
      .insert({ submission_id: commentSubmissionId, user_id: user.id, body })
      .select('id, submission_id, user_id, body, created_at')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, { ...data, username: 'you' }]);
      setCommentCounts((prev) => ({
        ...prev,
        [commentSubmissionId]: (prev[commentSubmissionId] ?? 0) + 1,
      }));
    } else if (error) {
      console.log('Comment failed:', error.message);
    }
  };

  const openNotifications = async () => {
    setNotifVisible(true);
    if (!user) return;
    setNotifLoading(true);

    const { data: mySubs } = await supabase.from('submissions').select('id, image_url').eq('user_id', user.id);
    const myIds = (mySubs ?? []).map((s) => s.id);
    const imageBySubId = new Map((mySubs ?? []).map((s) => [s.id, s.image_url]));

    if (myIds.length === 0) {
      setNotifications([]);
      setNotifLoading(false);
      return;
    }

    const { data: voteRows } = await supabase
      .from('votes')
      .select('id, user_id, submission_id, created_at')
      .in('submission_id', myIds)
      .neq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    const rows = voteRows ?? [];
    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }

    setNotifications(
      rows.map((r) => ({
        id: r.id,
        voterUsername: usernameById.get(r.user_id) ?? 'someone',
        imageUrl: imageBySubId.get(r.submission_id) ?? '',
        createdAt: r.created_at,
      }))
    );
    setNotifLoading(false);
  };

  const shareSubmission = async (item: Submission) => {
    try {
      await Share.share({
        message: `Check out ${item.username}'s photo on Frames for "${theme?.name}": ${item.image_url}`,
      });
    } catch (err) {
      console.log('Share failed:', err);
    }
  };

  const visibleSubmissions = searchQuery.trim()
    ? submissions.filter((s) => s.username.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : submissions;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.appName}>Frames</Text>
        <View style={styles.topBarIcons}>
          <Pressable onPress={() => setSearchVisible((v) => !v)}>
            <Ionicons name="search-outline" size={20} color="#1A2A32" />
          </Pressable>
          <Pressable onPress={openNotifications} style={{ marginLeft: 14 }}>
            <Ionicons name="notifications-outline" size={20} color="#1A2A32" />
          </Pressable>
        </View>
      </View>

      {searchVisible && (
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by username"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color="#9ca3af" />
            </Pressable>
          )}
        </View>
      )}

      <View style={styles.themeBanner}>
        <Text style={styles.themeLabel}>THIS WEEK'S THEME</Text>
        <Text style={styles.themeName}>{theme?.name ?? 'No active theme'}</Text>
        {theme && <Text style={styles.themeCountdown}>{formatCountdown(theme.end_date)}</Text>}
        {hasSubmittedThisTheme && (
          <View style={styles.submittedPill}>
            <Ionicons name="checkmark-circle" size={13} color="#166534" />
            <Text style={styles.submittedText}>Your submission is in</Text>
          </View>
        )}
      </View>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, format === 'digital' && styles.toggleActive]}
          onPress={() => setFormat('digital')}
        >
          <Text style={format === 'digital' ? styles.toggleTextActive : styles.toggleText}>
            Digital
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, format === 'film' && styles.toggleActive]}
          onPress={() => setFormat('film')}
        >
          <Text style={format === 'film' ? styles.toggleTextActive : styles.toggleText}>
            Film
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#0B1418" />
        </View>
      ) : errorMessage ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : (
        <FlatList
          style={styles.feedSheet}
          data={visibleSubmissions}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyText}>
                {searchQuery
                  ? `No results for "${searchQuery}"`
                  : `No ${format} submissions yet for this theme. Be the first!`}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const hasVoted = votedIds.has(item.id);
            return (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.avatar} />
                  <Text style={styles.username}>{item.username}</Text>
                  <Ionicons name="ellipsis-horizontal" size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
                </View>

                <Pressable onPress={() => handleImageTap(item.id)}>
                  <Image source={{ uri: item.image_url }} style={styles.image} />
                  {burstId === item.id && (
                    <View style={styles.burstOverlay} pointerEvents="none">
                      <Ionicons name="heart" size={80} color="#ffffff" />
                    </View>
                  )}
                </Pressable>

                <View style={styles.actionsRow}>
                  <Pressable style={styles.actionItem} onPress={() => handleHeartTap(item.id)}>
                    <Ionicons
                      name={hasVoted ? 'heart' : 'heart-outline'}
                      size={20}
                      color={hasVoted ? '#dc2626' : '#4b5563'}
                    />
                    <Text style={[styles.actionText, hasVoted && styles.actionTextActive]}>
                      {item.vote_count}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.actionItem} onPress={() => openComments(item.id)}>
                    <Ionicons name="chatbubble-outline" size={17} color="#4b5563" />
                    <Text style={styles.actionText}>{commentCounts[item.id] ?? 0}</Text>
                  </Pressable>
                  <Pressable style={{ marginLeft: 'auto' }} onPress={() => shareSubmission(item)}>
                    <Ionicons name="share-outline" size={18} color="#4b5563" />
                  </Pressable>
                </View>
              </View>
            );
          }}
        />
      )}

      <Modal visible={!!commentSubmissionId} animationType="slide" transparent onRequestClose={() => setCommentSubmissionId(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.commentSheet}>
            <View style={styles.commentSheetHeader}>
              <Text style={styles.commentSheetTitle}>Comments</Text>
              <Pressable onPress={() => setCommentSubmissionId(null)}>
                <Ionicons name="close" size={22} color="#374151" />
              </Pressable>
            </View>

            {commentsLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color="#0B1418" />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No comments yet. Say something nice.</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <Text style={styles.commentUsername}>{item.username}</Text>
                    <Text style={styles.commentBody}>{item.body}</Text>
                  </View>
                )}
              />
            )}

            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add a comment"
                value={commentInput}
                onChangeText={setCommentInput}
              />
              <Pressable style={styles.commentSendButton} onPress={postComment}>
                <Ionicons name="send" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={notifVisible} animationType="slide" transparent onRequestClose={() => setNotifVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.commentSheet}>
            <View style={styles.commentSheetHeader}>
              <Text style={styles.commentSheetTitle}>Notifications</Text>
              <Pressable onPress={() => setNotifVisible(false)}>
                <Ionicons name="close" size={22} color="#374151" />
              </Pressable>
            </View>

            {notifLoading ? (
              <ActivityIndicator style={{ marginTop: 20 }} color="#0B1418" />
            ) : (
              <FlatList
                data={notifications}
                keyExtractor={(n) => n.id}
                style={{ maxHeight: 400 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No new votes on your photos yet.</Text>
                }
                renderItem={({ item }) => (
                  <View style={styles.notifRow}>
                    {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.notifThumb} /> : null}
                    <Text style={styles.notifText}>
                      <Text style={{ fontWeight: '600' }}>{item.voterUsername}</Text> voted on your photo
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#D9E2E6' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  appName: { fontSize: 17, fontWeight: '600', color: '#1A2A32' },
  topBarIcons: { flexDirection: 'row', alignItems: 'center' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13 },

  themeBanner: { alignItems: 'center', paddingVertical: 16 },
  themeLabel: { fontSize: 11, color: '#46606B', letterSpacing: 0.5, marginBottom: 4 },
  themeName: { fontSize: 26, fontWeight: '700', color: '#0B1418' },
  themeCountdown: { fontSize: 12, color: '#46606B', marginTop: 6 },
  submittedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  submittedText: { fontSize: 11, color: '#166534', fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 8,
    padding: 2,
  },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  toggleActive: { backgroundColor: '#ffffff' },
  toggleText: { fontSize: 13, color: '#46606B' },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: '#0B1418' },

  feedSheet: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 4,
  },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 30 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center' },

  card: { paddingHorizontal: 16, paddingTop: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#dbeafe' },
  username: { fontSize: 14, fontWeight: '600', color: '#111827' },
  image: { width: '100%', height: 320, borderRadius: 10, backgroundColor: '#f3f4f6' },
  burstOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: '#4b5563' },
  actionTextActive: { color: '#dc2626', fontWeight: '600' },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  commentSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '75%',
  },
  commentSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentSheetTitle: { fontSize: 16, fontWeight: '600' },
  commentRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  commentUsername: { fontSize: 12, fontWeight: '600', color: '#374151' },
  commentBody: { fontSize: 13, color: '#111827', marginTop: 2 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  commentInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  commentSendButton: {
    backgroundColor: '#0B1418',
    borderRadius: 20,
    padding: 10,
  },

  notifRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  notifThumb: { width: 36, height: 36, borderRadius: 6, backgroundColor: '#f3f4f6' },
  notifText: { fontSize: 13, color: '#374151', flex: 1 },
});
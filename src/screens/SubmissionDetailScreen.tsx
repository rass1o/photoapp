import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Props = NativeStackScreenProps<RootStackParamList, 'SubmissionDetail'>;

type Submission = {
  id: string;
  user_id: string;
  image_url: string;
  vote_count: number;
  caption: string;
  username: string;
  avatar_url: string | null;
  avatar_frame_color: string;
};

type Comment = {
  id: string;
  user_id: string;
  body: string;
  username: string;
};

export default function SubmissionDetailScreen({ route, navigation }: Props) {
  const { submissionId } = route.params;
  const { user } = useAuth();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [aspectRatio, setAspectRatio] = useState(1);

  const load = async () => {
    const { data: subData, error } = await supabase
      .from('submissions')
      .select('id, user_id, image_url, vote_count, caption')
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

    if (user) {
      const { data: voteRow } = await supabase
        .from('votes')
        .select('id')
        .eq('user_id', user.id)
        .eq('submission_id', submissionId)
        .maybeSingle();
      setHasVoted(!!voteRow);
    }

    const { data: commentRows } = await supabase
      .from('comments')
      .select('id, user_id, body')
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

  const toggleVote = async () => {
    if (!user || !submission) return;
    const wasVoted = hasVoted;

    setHasVoted(!wasVoted);
    setSubmission((prev) => (prev ? { ...prev, vote_count: prev.vote_count + (wasVoted ? -1 : 1) } : prev));

    const { error } = wasVoted
      ? await supabase.from('votes').delete().eq('user_id', user.id).eq('submission_id', submissionId)
      : await supabase.from('votes').insert({ user_id: user.id, submission_id: submissionId });

    if (error) {
      setHasVoted(wasVoted);
      setSubmission((prev) => (prev ? { ...prev, vote_count: prev.vote_count + (wasVoted ? 1 : -1) } : prev));
    }
  };

  const postComment = async () => {
    if (!user || !commentInput.trim()) return;
    const body = commentInput.trim();
    setCommentInput('');

    const { data, error } = await supabase
      .from('comments')
      .insert({ submission_id: submissionId, user_id: user.id, body })
      .select('id, user_id, body')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, { ...data, username: 'you' }]);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator color="#0B1418" />
      </SafeAreaView>
    );
  }

  if (!submission) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Text style={styles.emptyText}>This photo couldn't be found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={styles.flex}
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={
          <View>
            <Pressable
              style={styles.userRow}
              onPress={() => navigation.push('UserProfile', { userId: submission.user_id })}
            >
              <View style={[styles.avatar, { borderColor: submission.avatar_frame_color }]}>
                {submission.avatar_url && (
                  <Image source={{ uri: submission.avatar_url }} style={styles.avatarImage} />
                )}
              </View>
              <Text style={styles.username}>{submission.username}</Text>
            </Pressable>

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

            <View style={styles.actionsRow}>
              <Pressable style={styles.actionItem} onPress={toggleVote}>
                <Ionicons
                  name={hasVoted ? 'heart' : 'heart-outline'}
                  size={22}
                  color={hasVoted ? '#dc2626' : '#4b5563'}
                />
                <Text style={[styles.actionText, hasVoted && styles.actionTextActive]}>
                  {submission.vote_count}
                </Text>
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
        ListEmptyComponent={<Text style={styles.emptyText}>No comments yet. Say something nice.</Text>}
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Text style={styles.commentUsername}>{item.username}</Text>
            <Text style={styles.commentBody}>{item.body}</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />

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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#ffffff' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 },

  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#ede9fe', borderWidth: 2, overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  username: { fontSize: 15, fontWeight: '600', color: '#111827' },

  image: { width: '100%', backgroundColor: '#f3f4f6' },

  actionsRow: { flexDirection: 'row', padding: 16 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: 15, color: '#4b5563' },
  actionTextActive: { color: '#dc2626', fontWeight: '600' },
  caption: { fontSize: 14, color: '#374151', paddingHorizontal: 16, paddingBottom: 12, lineHeight: 19 },
  captionUsername: { fontWeight: '600', color: '#111827' },

  commentsHeader: { fontSize: 13, fontWeight: '600', color: '#6b7280', paddingHorizontal: 16, marginBottom: 4 },
  commentRow: { paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  commentUsername: { fontSize: 12, fontWeight: '600', color: '#374151' },
  commentBody: { fontSize: 14, color: '#111827', marginTop: 2 },

  commentInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  commentSendButton: { backgroundColor: '#0B1418', borderRadius: 20, padding: 10 },
});
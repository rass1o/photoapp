import { useEffect, useState } from 'react';
import { View, StyleSheet, Image, Pressable, FlatList, ActivityIndicator, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import SectionHeader from '../components/SectionHeader';
import BackBar from '../components/BackBar';
import SeeAllButton, { GALLERY_PREVIEW } from '../components/SeeAllButton';
import { OctopusCard } from '../components/Octopus';
import { OctopusData, loadOctopus } from '../lib/octopus';
import { useAuth } from '../context/AuthContext';
import {
  FriendStatus,
  friendCount,
  getFriendship,
  removeFriendship,
  respondToRequest,
  sendFriendRequest,
} from '../lib/friends';
import { Text } from '../components/Themed';
import { colors, bubbly } from '../theme';
import Wave, { WAVE_HEIGHT } from '../components/Wave';
import SandGrain from '../components/SandGrain';
import StreakBanner from '../components/StreakBanner';
import { liveDailyStreak } from '../lib/streaks';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

type Profile = {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  avatar_frame_color: string;
  banner_color: string;
  badge: string;
  streak_count: number;
  daily_streak_count: number | null;
  last_daily_submission_date: string | null;
  currency_balance: number;
  showcase_url_1: string | null;
  showcase_url_2: string | null;
  showcase_url_3: string | null;
};

type GalleryItem = {
  id: string;
  image_url: string;
};

type CameraItem = {
  id: string;
  camera_name: string;
};

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { user } = useAuth();
  const isMe = user?.id === userId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [badgeLabel, setBadgeLabel] = useState('streak');
  const [octopus, setOctopus] = useState<{ data: OctopusData; line: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>('none');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [friends, setFriends] = useState(0);
  const [friendBusy, setFriendBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select(
          'id, username, bio, avatar_url, avatar_frame_color, banner_color, badge, streak_count, daily_streak_count, last_daily_submission_date, currency_balance, showcase_url_1, showcase_url_2, showcase_url_3'
        )
        .eq('id', userId)
        .single();

      setProfile(profileData);

      if (profileData?.badge) {
        const { data: badgeItem } = await supabase
          .from('shop_items')
          .select('label')
          .eq('category', 'badge')
          .eq('value', profileData.badge)
          .maybeSingle();
        if (badgeItem) setBadgeLabel(badgeItem.label);
      }

      const { data: galleryData } = await supabase
        .from('submissions')
        .select('id, image_url')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setGallery(galleryData ?? []);

      const { data: cameraData } = await supabase
        .from('camera_collection')
        .select('id, camera_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      setCameras(cameraData ?? []);

      const octo = await loadOctopus(userId);
      if (octo.octopus) setOctopus({ data: octo.octopus, line: octo.line });

      setFriends(await friendCount(userId));
      if (user && user.id !== userId) {
        const friendship = await getFriendship(user.id, userId);
        setFriendStatus(friendship.status);
        setRequestId(friendship.requestId);
      }

      setIsLoading(false);
    };

    load();
  }, [userId, user]);

  // Runs a friend action, then re-reads where things stand from the server
  const friendAction = async (action: () => Promise<unknown>) => {
    if (!user) return;
    setFriendBusy(true);
    try {
      await action();
    } catch (err) {
      Alert.alert('Couldn\u2019t do that', err instanceof Error ? err.message : 'Please try again.');
    }
    const [friendship, count] = await Promise.all([getFriendship(user.id, userId), friendCount(userId)]);
    setFriendStatus(friendship.status);
    setRequestId(friendship.requestId);
    setFriends(count);
    setFriendBusy(false);
  };

  const onFriendButton = () => {
    if (!profile) return;
    if (friendStatus === 'none') {
      friendAction(() => sendFriendRequest(userId));
    } else if (friendStatus === 'outgoing') {
      Alert.alert('Cancel friend request?', `${profile.username} won\u2019t see it anymore.`, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'Cancel request', style: 'destructive', onPress: () => friendAction(() => removeFriendship(userId)) },
      ]);
    } else if (friendStatus === 'friends') {
      Alert.alert(`Unfriend ${profile.username}?`, 'Their photos will only show in Global.', [
        { text: 'Stay friends', style: 'cancel' },
        { text: 'Unfriend', style: 'destructive', onPress: () => friendAction(() => removeFriendship(userId)) },
      ]);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <BackBar />
        <View style={styles.centered}>
          <ActivityIndicator color={colors.deep} />
        </View>
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <BackBar />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>This user couldn't be found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const showcaseUrls = [profile.showcase_url_1, profile.showcase_url_2, profile.showcase_url_3].filter(
    (url): url is string => !!url
  );

  return (
    <View style={[styles.screen, { backgroundColor: profile.banner_color }]}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.flex}>
        <BackBar />
        <View style={styles.header}>
          <View style={[styles.avatar, { borderColor: profile.avatar_frame_color }]}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
            )}
          </View>
          <Text style={styles.username}>{profile.username}</Text>
          <Text style={styles.bio}>{profile.bio || 'No bio yet'}</Text>

          {!isMe &&
            (friendStatus === 'incoming' && requestId ? (
              <View style={styles.friendButtonRow}>
                <Pressable
                  style={[styles.friendButton, styles.friendButtonPrimary]}
                  disabled={friendBusy}
                  onPress={() => friendAction(() => respondToRequest(requestId, true))}
                >
                  <Ionicons name="checkmark" size={15} color={colors.white} />
                  <Text style={styles.friendButtonTextPrimary}>Accept request</Text>
                </Pressable>
                <Pressable
                  style={styles.friendButton}
                  disabled={friendBusy}
                  onPress={() => friendAction(() => respondToRequest(requestId, false))}
                >
                  <Text style={styles.friendButtonText}>Decline</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.friendButtonRow}>
                <Pressable
                  style={[styles.friendButton, friendStatus === 'none' && styles.friendButtonPrimary]}
                  disabled={friendBusy}
                  onPress={onFriendButton}
                >
                  {friendBusy ? (
                    <ActivityIndicator size="small" color={friendStatus === 'none' ? colors.white : colors.deep} />
                  ) : (
                    <>
                      <Ionicons
                        name={
                          friendStatus === 'friends'
                            ? 'people'
                            : friendStatus === 'outgoing'
                              ? 'time-outline'
                              : 'person-add-outline'
                        }
                        size={15}
                        color={friendStatus === 'none' ? colors.white : colors.deep}
                      />
                      <Text style={friendStatus === 'none' ? styles.friendButtonTextPrimary : styles.friendButtonText}>
                        {friendStatus === 'friends' ? 'Friends' : friendStatus === 'outgoing' ? 'Requested' : 'Add friend'}
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ))}

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gallery.length}</Text>
              <Text style={styles.statLabel}>submissions</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{friends}</Text>
              <Text style={styles.statLabel}>friends</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.currency_balance}</Text>
              <Text style={styles.statLabel}>shutters</Text>
            </View>
          </View>

          <View style={styles.streakPill}>
            <Ionicons name={(profile.badge as any) ?? 'flame-outline'} size={13} color="#92400e" />
            <Text style={styles.streakText}>
              {badgeLabel}
            </Text>
          </View>

          <View style={styles.streakBanner}>
            <StreakBanner
              daily={liveDailyStreak(profile.daily_streak_count, profile.last_daily_submission_date)}
              weekly={profile.streak_count}
            />
          </View>
        </View>

        <View style={styles.sheet}>
          <SandGrain />
          <Wave water={profile.banner_color} />
          <FlatList
            data={gallery.slice(0, GALLERY_PREVIEW)}
            keyExtractor={(g) => g.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 6 }}
            contentContainerStyle={{ paddingTop: WAVE_HEIGHT + 2, paddingBottom: 20 }}
            ListHeaderComponent={
              <View>
                {showcaseUrls.length > 0 && (
                  <>
                    <SectionHeader icon="images-outline" label="Showcase" />
                    <View style={styles.showcaseRow}>
                      {showcaseUrls.map((url, i) => (
                        <Pressable
                          key={i}
                          style={styles.showcaseTile}
                          onPress={() => setViewerUrl(url)}
                        >
                          <Image source={{ uri: url }} style={styles.showcaseImage} />
                        </Pressable>
                      ))}
                    </View>
                  </>
                )}

                {cameras.length > 0 && (
                  <>
                    <SectionHeader icon="camera-outline" label="Camera collection" />
                    <View style={styles.cameraList}>
                      {cameras.map((c) => (
                        <View key={c.id} style={styles.cameraChip}>
                          <Ionicons name="camera-outline" size={13} color={colors.text} />
                          <Text style={styles.cameraChipText}>{c.camera_name}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <SectionHeader icon="grid-outline" label="Gallery" />
              </View>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No submissions yet.</Text>}
            ListFooterComponent={
              <View>
                {gallery.length > GALLERY_PREVIEW && (
                  <SeeAllButton
                    count={gallery.length}
                    onPress={() => navigation.push('Gallery', { userId, username: profile.username })}
                  />
                )}
                {octopus && (
                  <View style={styles.octopusSection}>
                    <SectionHeader icon="happy-outline" label={`${profile.username}\u2019s octopus`} />
                    <OctopusCard
                      name={octopus.data.name}
                      line={octopus.line}
                      color={octopus.data.color}
                      accessory={octopus.data.accessory}
                      heldItem={octopus.data.held_item}
                      pet={octopus.data.pet}
                    />
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.galleryTile}
                onPress={() => navigation.push('SubmissionDetail', { submissionId: item.id })}
              >
                <Image source={{ uri: item.image_url }} style={styles.galleryImage} />
              </Pressable>
            )}
          />
        </View>
      </SafeAreaView>

      <Modal visible={!!viewerUrl} transparent animationType="fade" onRequestClose={() => setViewerUrl(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerUrl(null)}>
          {viewerUrl && <Image source={{ uri: viewerUrl }} style={styles.viewerImage} resizeMode="contain" />}
          <Pressable style={styles.viewerCloseButton} onPress={() => setViewerUrl(null)}>
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  octopusSection: { marginTop: 18 },
  screen: { flex: 1 },
  flex: { flex: 1 },
  page: { flex: 1, backgroundColor: colors.shell },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.shell },
  emptyText: { color: colors.faint, fontSize: 13, textAlign: 'center', padding: 20 },

  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.coralLight,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 18, fontWeight: '600', color: colors.coral },
  username: { ...bubbly, fontSize: 24 },
  bio: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 8, textAlign: 'center', paddingHorizontal: 30 },
  streakBanner: { alignSelf: 'stretch', paddingHorizontal: 16, marginTop: 12 },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 10 },
  friendButtonRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  friendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minWidth: 120,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.shell,
  },
  friendButtonPrimary: { backgroundColor: colors.deep },
  friendButtonText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  friendButtonTextPrimary: { fontSize: 13, fontWeight: '600', color: colors.white },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: colors.deep },
  statLabel: { fontSize: 11, color: colors.muted },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  streakText: { fontSize: 11, color: '#92400e', fontWeight: '500' },

  sheet: {
    flex: 1,
    backgroundColor: colors.shell,
    paddingHorizontal: 16,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 8, marginTop: 4 },

  showcaseRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  showcaseTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.sand,
    overflow: 'hidden',
  },
  showcaseImage: { width: '100%', height: '100%' },

  cameraList: { marginBottom: 18, gap: 6 },
  cameraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cameraChipText: { fontSize: 13, color: colors.text },

  galleryTile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.sand },
  galleryImage: { width: '100%', height: '100%' },

  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerImage: { width: '100%', height: '80%' },
  viewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
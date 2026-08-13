import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, ActivityIndicator, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';
import SectionHeader from '../components/SectionHeader';

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

const BADGE_LABELS: Record<string, string> = {
  'flame-outline': 'streak',
  'star-outline': 'top voter',
  'flash-outline': 'early bird',
  'ribbon-outline': 'weekly winner',
};

export default function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select(
          'id, username, bio, avatar_url, avatar_frame_color, banner_color, badge, streak_count, currency_balance, showcase_url_1, showcase_url_2, showcase_url_3'
        )
        .eq('id', userId)
        .single();

      setProfile(profileData);

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

      setIsLoading(false);
    };

    load();
  }, [userId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <ActivityIndicator color="#0B1418" />
      </SafeAreaView>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.centered} edges={['bottom']}>
        <Text style={styles.emptyText}>This user couldn't be found.</Text>
      </SafeAreaView>
    );
  }

  const badgeLabel = BADGE_LABELS[profile.badge] ?? 'streak';
  const showcaseUrls = [profile.showcase_url_1, profile.showcase_url_2, profile.showcase_url_3].filter(
    (url): url is string => !!url
  );

  return (
    <View style={[styles.screen, { backgroundColor: profile.banner_color }]}>
      <SafeAreaView edges={['bottom']} style={styles.flex}>
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

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.streak_count}</Text>
              <Text style={styles.statLabel}>streak</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{gallery.length}</Text>
              <Text style={styles.statLabel}>submissions</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{profile.currency_balance}</Text>
              <Text style={styles.statLabel}>shutters</Text>
            </View>
          </View>

          <View style={styles.streakPill}>
            <Ionicons name={(profile.badge as any) ?? 'flame-outline'} size={13} color="#92400e" />
            <Text style={styles.streakText}>
              {profile.streak_count} week streak · {badgeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <FlatList
            data={gallery}
            keyExtractor={(g) => g.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 6 }}
            contentContainerStyle={{ paddingBottom: 20 }}
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
                          <Ionicons name="camera-outline" size={13} color="#374151" />
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
            <Ionicons name="close" size={22} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff' },
  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', padding: 20 },

  header: { alignItems: 'center', paddingTop: 8, paddingBottom: 14 },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ede9fe',
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 18, fontWeight: '600', color: '#6d28d9' },
  username: { fontSize: 18, fontWeight: '700', color: '#0B1418' },
  bio: { fontSize: 13, color: '#46606B', marginTop: 2, marginBottom: 8, textAlign: 'center', paddingHorizontal: 30 },
  statsRow: { flexDirection: 'row', gap: 24, marginBottom: 10 },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#0B1418' },
  statLabel: { fontSize: 11, color: '#46606B' },
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
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 4 },

  showcaseRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  showcaseTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    overflow: 'hidden',
  },
  showcaseImage: { width: '100%', height: '100%' },

  cameraList: { marginBottom: 18, gap: 6 },
  cameraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cameraChipText: { fontSize: 13, color: '#374151' },

  galleryTile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' },
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
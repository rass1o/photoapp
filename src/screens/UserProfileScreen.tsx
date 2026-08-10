import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/AppNavigator';
import { supabase } from '../lib/supabase';

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
};

type GalleryItem = {
  id: string;
  image_url: string;
  vote_count: number;
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, username, bio, avatar_url, avatar_frame_color, banner_color, badge, streak_count')
        .eq('id', userId)
        .single();

      setProfile(profileData);

      const { data: galleryData } = await supabase
        .from('submissions')
        .select('id, image_url, vote_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      setGallery(galleryData ?? []);
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

          <View style={styles.streakPill}>
            <Ionicons name={(profile.badge as any) ?? 'flame-outline'} size={13} color="#92400e" />
            <Text style={styles.streakText}>
              {profile.streak_count} week streak · {badgeLabel}
            </Text>
          </View>
        </View>

        <View style={styles.sheet}>
          <Text style={styles.sectionLabel}>Gallery</Text>
          <FlatList
            data={gallery}
            keyExtractor={(g) => g.id}
            numColumns={3}
            columnWrapperStyle={{ gap: 6 }}
            contentContainerStyle={{ gap: 6 }}
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
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8 },
  galleryTile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  galleryImage: { width: '100%', height: '100%' },
});
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, Image, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { RootStackParamList } from '../navigation/AppNavigator';
import SectionHeader from '../components/SectionHeader';

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

type GoalItem = {
  id: string;
  text: string;
  is_completed: boolean;
};

type CustomizeButtonProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  accent?: boolean;
};

function CustomizeButton({ icon, label, onPress, accent }: CustomizeButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.customizeButton, accent && styles.customizeButtonAccent]}
    >
      <Ionicons name={icon} size={16} color={accent ? '#4f46e5' : '#374151'} />
      <Text style={[styles.customizeButtonText, accent && styles.customizeButtonTextAccent]}>
        {label}
      </Text>
    </Pressable>
  );
}

const FRAME_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981'];
const BANNER_COLORS = ['#D9E2E6', '#FDE8D9', '#E4DFF7', '#DCEEE4'];
const BADGES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'flame-outline', label: 'streak' },
  { icon: 'star-outline', label: 'top voter' },
  { icon: 'flash-outline', label: 'early bird' },
  { icon: 'ribbon-outline', label: 'weekly winner' },
];

const SHOWCASE_KEYS = ['showcase_url_1', 'showcase_url_2', 'showcase_url_3'] as const;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [newCameraName, setNewCameraName] = useState('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadingShowcaseSlot, setUploadingShowcaseSlot] = useState<number | null>(null);

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState('');

  const loadProfile = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (!error && data) setProfile(data);

    const { data: galleryData } = await supabase
      .from('submissions')
      .select('id, image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setGallery(galleryData ?? []);

    const { data: cameraData } = await supabase
      .from('camera_collection')
      .select('id, camera_name')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setCameras(cameraData ?? []);

    const { data: goalsData } = await supabase
      .from('goals')
      .select('id, text, is_completed')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setGoals(goalsData ?? []);
  };

  useEffect(() => {
    setIsLoading(true);
    loadProfile().finally(() => setIsLoading(false));
  }, [user]);

  const updateProfile = async (changes: Partial<Profile>) => {
    if (!user || !profile) return;
    setProfile({ ...profile, ...changes });
    const { error } = await supabase.from('profiles').update(changes).eq('id', user.id);
    if (error) console.log('Profile update failed:', error.message);
  };

  const pickAvatar = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = uri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await updateProfile({ avatar_url: publicUrlData.publicUrl });
    } catch (err) {
      console.log('Avatar upload failed:', err);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const pickShowcasePhoto = async (slotIndex: 0 | 1 | 2) => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a showcase photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingShowcaseSlot(slotIndex);
    try {
      const uri = result.assets[0].uri;
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = uri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/showcase-${slotIndex}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);
      await updateProfile({ [SHOWCASE_KEYS[slotIndex]]: publicUrlData.publicUrl });
    } catch (err) {
      console.log('Showcase upload failed:', err);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setUploadingShowcaseSlot(null);
    }
  };

  const clearShowcaseSlot = (slotIndex: 0 | 1 | 2) => {
    updateProfile({ [SHOWCASE_KEYS[slotIndex]]: null });
  };

  const addCamera = async () => {
    if (!user || !newCameraName.trim()) return;
    const name = newCameraName.trim();
    setNewCameraName('');

    const { data, error } = await supabase
      .from('camera_collection')
      .insert({ user_id: user.id, camera_name: name })
      .select('id, camera_name')
      .single();

    if (!error && data) {
      setCameras((prev) => [...prev, data]);
    } else if (error) {
      console.log('Add camera failed:', error.message);
    }
  };

  const removeCamera = async (id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase.from('camera_collection').delete().eq('id', id);
    if (error) console.log('Remove camera failed:', error.message);
  };

  const addGoal = async () => {
    if (!user || !newGoalText.trim()) return;
    const text = newGoalText.trim();
    setNewGoalText('');

    const { data, error } = await supabase
      .from('goals')
      .insert({ user_id: user.id, text })
      .select('id, text, is_completed')
      .single();

    if (!error && data) {
      setGoals((prev) => [...prev, data]);
    } else if (error) {
      console.log('Add goal failed:', error.message);
    }
  };

  const toggleGoal = async (id: string, current: boolean) => {
    setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, is_completed: !current } : g)));
    const { error } = await supabase.from('goals').update({ is_completed: !current }).eq('id', id);
    if (error) console.log('Toggle goal failed:', error.message);
  };

  const removeGoal = async (id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    const { error } = await supabase.from('goals').delete().eq('id', id);
    if (error) console.log('Remove goal failed:', error.message);
  };

  const cycleFrame = () => {
    if (!profile) return;
    const next = FRAME_COLORS[(FRAME_COLORS.indexOf(profile.avatar_frame_color) + 1) % FRAME_COLORS.length];
    updateProfile({ avatar_frame_color: next });
  };

  const cycleBanner = () => {
    if (!profile) return;
    const next = BANNER_COLORS[(BANNER_COLORS.indexOf(profile.banner_color) + 1) % BANNER_COLORS.length];
    updateProfile({ banner_color: next });
  };

  const cycleBadge = () => {
    if (!profile) return;
    const currentIndex = BADGES.findIndex((b) => b.icon === profile.badge);
    const next = BADGES[(currentIndex + 1) % BADGES.length];
    updateProfile({ badge: next.icon });
  };

  const startEditBio = () => {
    setDraftBio(profile?.bio ?? '');
    setIsEditingBio(true);
  };

  const saveBio = () => {
    updateProfile({ bio: draftBio.trim() });
    setIsEditingBio(false);
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={[styles.screen, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color="#0B1418" />
      </SafeAreaView>
    );
  }

  const activeBadge = BADGES.find((b) => b.icon === profile.badge) ?? BADGES[0];
  const showcaseUrls = [profile.showcase_url_1, profile.showcase_url_2, profile.showcase_url_3];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: profile.banner_color }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={pickAvatar} style={[styles.avatar, { borderColor: profile.avatar_frame_color }]}>
          {isUploadingAvatar ? (
            <ActivityIndicator color="#6d28d9" />
          ) : profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={12} color="#ffffff" />
          </View>
        </Pressable>

        <Text style={styles.username}>{profile.username}</Text>

        {isEditingBio ? (
          <View style={styles.bioEditRow}>
            <TextInput
              style={styles.bioInput}
              value={draftBio}
              onChangeText={setDraftBio}
              autoFocus
              maxLength={80}
              placeholder="Add a bio"
            />
            <Pressable onPress={saveBio} style={styles.bioSaveButton}>
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.bio}>{profile.bio || 'Add a bio'}</Text>
        )}

        <Pressable style={styles.streakPill} onPress={cycleBadge}>
          <Ionicons name={activeBadge.icon} size={13} color="#92400e" />
          <Text style={styles.streakText}>
            {profile.streak_count} week streak · {activeBadge.label}
          </Text>
        </Pressable>
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

              <SectionHeader icon="options-outline" label="Customize" />
              <View style={styles.customizeGrid}>
                <CustomizeButton icon="ellipse-outline" label="Avatar frame" onPress={cycleFrame} />
                <CustomizeButton icon="image-outline" label="Banner" onPress={cycleBanner} />
                <CustomizeButton icon="ribbon-outline" label="Badge" onPress={cycleBadge} />
                <CustomizeButton icon="create-outline" label="Edit bio" onPress={startEditBio} accent />
              </View>

              <SectionHeader icon="flag-outline" label="Goals" />
              <View style={styles.goalsList}>
                {goals.length === 0 ? (
                  <Text style={styles.emptyText}>No goals yet. Set something to work toward.</Text>
                ) : (
                  goals.map((g) => (
                    <View key={g.id} style={styles.goalRow}>
                      <Pressable onPress={() => toggleGoal(g.id, g.is_completed)} style={styles.goalCheckbox}>
                        <Ionicons
                          name={g.is_completed ? 'checkbox' : 'square-outline'}
                          size={19}
                          color={g.is_completed ? '#10b981' : '#9ca3af'}
                        />
                      </Pressable>
                      <Text style={[styles.goalText, g.is_completed && styles.goalTextCompleted]}>
                        {g.text}
                      </Text>
                      <Pressable onPress={() => removeGoal(g.id)}>
                        <Ionicons name="close-circle" size={16} color="#d1d5db" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
              <View style={styles.addGoalRow}>
                <TextInput
                  style={styles.addGoalInput}
                  placeholder="e.g. Shoot 5 golden hour photos"
                  value={newGoalText}
                  onChangeText={setNewGoalText}
                  onSubmitEditing={addGoal}
                  returnKeyType="done"
                />
                <Pressable style={styles.addCameraButton} onPress={addGoal}>
                  <Ionicons name="add" size={18} color="#ffffff" />
                </Pressable>
              </View>

              <SectionHeader icon="images-outline" label="Showcase" />
              <View style={styles.showcaseRow}>
                {showcaseUrls.map((url, i) => (
                  <Pressable
                    key={i}
                    style={styles.showcaseTile}
                    onPress={() => pickShowcasePhoto(i as 0 | 1 | 2)}
                  >
                    {uploadingShowcaseSlot === i ? (
                      <ActivityIndicator color="#6d28d9" />
                    ) : url ? (
                      <>
                        <Image source={{ uri: url }} style={styles.showcaseImage} />
                        <Pressable
                          style={styles.showcaseRemove}
                          onPress={() => clearShowcaseSlot(i as 0 | 1 | 2)}
                        >
                          <Ionicons name="close" size={12} color="#ffffff" />
                        </Pressable>
                      </>
                    ) : (
                      <Ionicons name="add" size={22} color="#9ca3af" />
                    )}
                  </Pressable>
                ))}
              </View>

              <SectionHeader icon="camera-outline" label="Camera collection" />
              <View style={styles.cameraList}>
                {cameras.length === 0 ? (
                  <Text style={styles.emptyText}>No cameras added yet.</Text>
                ) : (
                  cameras.map((c) => (
                    <View key={c.id} style={styles.cameraChip}>
                      <Ionicons name="camera-outline" size={13} color="#374151" />
                      <Text style={styles.cameraChipText}>{c.camera_name}</Text>
                      <Pressable onPress={() => removeCamera(c.id)}>
                        <Ionicons name="close-circle" size={15} color="#9ca3af" />
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
              <View style={styles.addCameraRow}>
                <TextInput
                  style={styles.addCameraInput}
                  placeholder="e.g. Canon AE-1"
                  value={newCameraName}
                  onChangeText={setNewCameraName}
                  onSubmitEditing={addCamera}
                  returnKeyType="done"
                />
                <Pressable style={styles.addCameraButton} onPress={addCamera}>
                  <Ionicons name="add" size={18} color="#ffffff" />
                </Pressable>
              </View>

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
          ListFooterComponent={
            <Pressable style={styles.signOutButton} onPress={signOut}>
              <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 14 },
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
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0B1418',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  username: { fontSize: 18, fontWeight: '700', color: '#0B1418' },
  bio: { fontSize: 13, color: '#46606B', marginTop: 2, marginBottom: 8 },
  bioEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
    paddingHorizontal: 20,
  },
  bioInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  bioSaveButton: { backgroundColor: '#0B1418', borderRadius: 6, padding: 8 },
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
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9ca3af' },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8, marginTop: 4 },

  customizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  customizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '48%',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  customizeButtonAccent: { borderColor: '#c7d2fe', backgroundColor: '#eef2ff' },
  customizeButtonText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  customizeButtonTextAccent: { color: '#4f46e5' },

  goalsList: { marginBottom: 10, gap: 6 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  goalCheckbox: { padding: 2 },
  goalText: { flex: 1, fontSize: 13, color: '#374151' },
  goalTextCompleted: { color: '#9ca3af', textDecorationLine: 'line-through' },
  addGoalRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  addGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },

  showcaseRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  showcaseTile: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  showcaseImage: { width: '100%', height: '100%' },
  showcaseRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraList: { marginBottom: 10, gap: 6 },
  cameraChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cameraChipText: { flex: 1, fontSize: 13, color: '#374151' },
  addCameraRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  addCameraInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  addCameraButton: {
    backgroundColor: '#0B1418',
    borderRadius: 8,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: { color: '#9ca3af', fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  galleryTile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f3f4f6' },
  galleryImage: { width: '100%', height: '100%' },

  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    marginBottom: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  signOutText: { fontSize: 13, color: '#b91c1c', fontWeight: '500' },
});
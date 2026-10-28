import { useCallback, useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Image, FlatList, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { readImage } from '../lib/upload';
import { ProfileCategory, ShopItem, PROFILE_COLUMN, isOwned, loadShop } from '../lib/shop';
import type { RootStackParamList } from '../navigation/AppNavigator';
import SectionHeader from '../components/SectionHeader';
import { OctopusCard } from '../components/Octopus';
import LockerModal from '../components/LockerModal';
import FriendsModal, { FriendsTab } from '../components/FriendsModal';
import { OctopusData, loadOctopus } from '../lib/octopus';
import {
  FriendProfile,
  FriendRequest,
  loadFriends,
  loadIncomingRequests,
  onFriendsChanged,
  respondToRequest,
} from '../lib/friends';
import { Text, TextInput } from '../components/Themed';
import { colors, bubbly } from '../theme';
import Wave from '../components/Wave';

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
      <Ionicons name={icon} size={16} color={accent ? colors.reef : colors.text} />
      <Text style={[styles.customizeButtonText, accent && styles.customizeButtonTextAccent]}>
        {label}
      </Text>
    </Pressable>
  );
}

const SHOWCASE_KEYS = ['showcase_url_1', 'showcase_url_2', 'showcase_url_3'] as const;

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [newCameraName, setNewCameraName] = useState('');
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [ownedIds, setOwnedIds] = useState<Set<string>>(new Set());
  const [lockerCategory, setLockerCategory] = useState<ProfileCategory | null>(null);
  const [octopus, setOctopus] = useState<{ data: OctopusData; line: string } | null>(null);
  const [friends, setFriends] = useState<FriendProfile[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendsTab, setFriendsTab] = useState<FriendsTab | null>(null);
  const [respondingIds, setRespondingIds] = useState<Set<string>>(new Set());
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

    const shop = await loadShop(user.id);
    setShopItems(shop.items);
    setOwnedIds(shop.ownedIds);

    const octo = await loadOctopus(user.id);
    setOctopus(octo.octopus ? { data: octo.octopus, line: octo.line } : null);

    await loadFriendData();
  };

  const loadFriendData = async () => {
    if (!user) return;
    const [friendList, requests] = await Promise.all([loadFriends(user.id), loadIncomingRequests(user.id)]);
    setFriends(friendList);
    setFriendRequests(requests);
  };

  // Requests arriving live, or answered from the popup, update this screen too
  useEffect(() => onFriendsChanged(() => loadFriendData()), [user]);

  const respondToFriendRequest = async (request: FriendRequest, accept: boolean) => {
    setRespondingIds((prev) => new Set(prev).add(request.id));
    try {
      await respondToRequest(request.id, accept);
    } catch (err) {
      Alert.alert('Couldn’t do that', err instanceof Error ? err.message : 'Please try again.');
      await loadFriendData();
    } finally {
      setRespondingIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const openFriendProfile = (userId: string) => {
    setFriendsTab(null);
    navigation.push('UserProfile', { userId });
  };

  // Reload on focus so purchases from the Shop tab and new balances show up.
  // Only the first load shows the full-screen spinner.
  const hasLoadedRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!hasLoadedRef.current) setIsLoading(true);
      loadProfile().finally(() => {
        hasLoadedRef.current = true;
        setIsLoading(false);
      });
    }, [user])
  );

  const updateProfile = async (changes: Partial<Profile>) => {
    if (!user || !profile) return;
    const previous = profile;
    setProfile({ ...profile, ...changes });
    const { error } = await supabase.from('profiles').update(changes).eq('id', user.id);
    if (error) {
      setProfile(previous);
      Alert.alert('Couldn\u2019t save that', error.message);
    }
  };

  const pickAvatar = async () => {
    if (!user) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to set a profile picture.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (result.canceled || !result.assets[0]) return;

    setIsUploadingAvatar(true);
    try {
      const uri = result.assets[0].uri;
      const image = await readImage(uri);
      const filePath = `${user.id}/avatar-${Date.now()}.${image.ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, image.bytes, { contentType: image.contentType });

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
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingShowcaseSlot(slotIndex);
    try {
      const uri = result.assets[0].uri;
      const image = await readImage(uri);
      const filePath = `${user.id}/showcase-${slotIndex}-${Date.now()}.${image.ext}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, image.bytes, { contentType: image.contentType });

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

  const equipFromLocker = (item: ShopItem) => {
    if (!lockerCategory) return;
    updateProfile({ [PROFILE_COLUMN[lockerCategory]]: item.value });
  };

  const openShopFromLocker = () => {
    setLockerCategory(null);
    navigation.navigate('MainTabs', { screen: 'Shop' });
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
        <ActivityIndicator color={colors.deep} />
      </SafeAreaView>
    );
  }

  const badgeLabel = shopItems.find((i) => i.category === 'badge' && i.value === profile.badge)?.label ?? 'streak';
  const showcaseUrls = [profile.showcase_url_1, profile.showcase_url_2, profile.showcase_url_3];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: profile.banner_color }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={pickAvatar} style={[styles.avatar, { borderColor: profile.avatar_frame_color }]}>
          {isUploadingAvatar ? (
            <ActivityIndicator color={colors.coral} />
          ) : profile.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
          )}
          <View style={styles.avatarEditBadge}>
            <Ionicons name="camera" size={12} color={colors.white} />
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
              <Ionicons name="checkmark" size={16} color={colors.white} />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.bio}>{profile.bio || 'Add a bio'}</Text>
        )}

        <Pressable style={styles.streakPill} onPress={() => setLockerCategory('badge')}>
          <Ionicons name={profile.badge as keyof typeof Ionicons.glyphMap} size={13} color="#92400e" />
          <Text style={styles.streakText}>
            {profile.streak_count} week streak · {badgeLabel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <Wave />
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
                <Pressable style={styles.stat} onPress={() => setFriendsTab('friends')}>
                  <Text style={styles.statValue}>{friends.length}</Text>
                  <Text style={styles.statLabel}>friends</Text>
                </Pressable>
                <View style={styles.stat}>
                  <Text style={styles.statValue}>{profile.currency_balance}</Text>
                  <Text style={styles.statLabel}>shutters</Text>
                </View>
              </View>

              <SectionHeader icon="options-outline" label="Customize" />
              <View style={styles.customizeGrid}>
                <CustomizeButton icon="ellipse-outline" label="Avatar frame" onPress={() => setLockerCategory('frame')} />
                <CustomizeButton icon="image-outline" label="Banner" onPress={() => setLockerCategory('banner')} />
                <CustomizeButton icon="ribbon-outline" label="Badge" onPress={() => setLockerCategory('badge')} />
                <CustomizeButton icon="create-outline" label="Edit bio" onPress={startEditBio} accent />
              </View>

              <SectionHeader icon="people-outline" label="Friends" />
              <View style={styles.customizeGrid}>
                <CustomizeButton
                  icon="people-outline"
                  label={`Friends · ${friends.length}`}
                  onPress={() => setFriendsTab('friends')}
                />
                <CustomizeButton
                  icon="person-add-outline"
                  label={friendRequests.length > 0 ? `Requests · ${friendRequests.length}` : 'Requests'}
                  onPress={() => setFriendsTab('requests')}
                  accent={friendRequests.length > 0}
                />
              </View>

              <SectionHeader icon="flag-outline" label="Goals" />
              <View style={styles.goalsList}>
                {goals.length === 0 ? (
                  <Text style={styles.emptyText}>No goals yet. Seas the day and set one.</Text>
                ) : (
                  goals.map((g) => (
                    <View key={g.id} style={styles.goalRow}>
                      <Pressable onPress={() => toggleGoal(g.id, g.is_completed)} style={styles.goalCheckbox}>
                        <Ionicons
                          name={g.is_completed ? 'checkbox' : 'square-outline'}
                          size={19}
                          color={g.is_completed ? '#10b981' : colors.faint}
                        />
                      </Pressable>
                      <Text style={[styles.goalText, g.is_completed && styles.goalTextCompleted]}>
                        {g.text}
                      </Text>
                      <Pressable onPress={() => removeGoal(g.id)}>
                        <Ionicons name="close-circle" size={16} color={colors.sandDark} />
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
                  <Ionicons name="add" size={18} color={colors.white} />
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
                      <ActivityIndicator color={colors.coral} />
                    ) : url ? (
                      <>
                        <Image source={{ uri: url }} style={styles.showcaseImage} />
                        <Pressable
                          style={styles.showcaseRemove}
                          onPress={() => clearShowcaseSlot(i as 0 | 1 | 2)}
                        >
                          <Ionicons name="close" size={12} color={colors.white} />
                        </Pressable>
                      </>
                    ) : (
                      <Ionicons name="add" size={22} color={colors.faint} />
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
                      <Ionicons name="camera-outline" size={13} color={colors.text} />
                      <Text style={styles.cameraChipText}>{c.camera_name}</Text>
                      <Pressable onPress={() => removeCamera(c.id)}>
                        <Ionicons name="close-circle" size={15} color={colors.faint} />
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
                  <Ionicons name="add" size={18} color={colors.white} />
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
            <View>
              {octopus && (
                <View style={styles.octopusSection}>
                  <SectionHeader icon="happy-outline" label="Your octopus" />
                  <OctopusCard
                    name={octopus.data.name}
                    line={octopus.line}
                    color={octopus.data.color}
                    accessory={octopus.data.accessory}
                    heldItem={octopus.data.held_item}
                  />
                  <Pressable style={styles.octopusButton} onPress={() => navigation.push('Octopus')}>
                    <Ionicons name="color-wand-outline" size={16} color={colors.reef} />
                    <Text style={styles.octopusButtonText}>Customize {octopus.data.name}</Text>
                  </Pressable>
                </View>
              )}
              <Pressable style={styles.signOutButton} onPress={signOut}>
                <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            </View>
          }
        />
      </View>

      <LockerModal
        category={lockerCategory}
        ownedItems={shopItems.filter((i) => i.category === lockerCategory && isOwned(i, ownedIds))}
        equippedValue={lockerCategory ? profile[PROFILE_COLUMN[lockerCategory]] : null}
        onEquip={equipFromLocker}
        onClose={() => setLockerCategory(null)}
        onOpenShop={openShopFromLocker}
      />

      <FriendsModal
        tab={friendsTab}
        friends={friends}
        requests={friendRequests}
        busyIds={respondingIds}
        onTabChange={setFriendsTab}
        onRespond={respondToFriendRequest}
        onOpenProfile={openFriendProfile}
        onClose={() => setFriendsTab(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { alignItems: 'center', paddingTop: 20, paddingBottom: 26 },
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
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.deep,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  username: { ...bubbly, fontSize: 24 },
  bio: { fontSize: 13, color: colors.muted, marginTop: 2, marginBottom: 8 },
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
    backgroundColor: colors.shell,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  bioSaveButton: { backgroundColor: colors.deep, borderRadius: 6, padding: 8 },
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
    paddingTop: 14,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: colors.sand,
    marginBottom: 14,
  },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '600', color: colors.ink },
  statLabel: { fontSize: 11, color: colors.faint },

  sectionLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 8, marginTop: 4 },

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
    borderColor: colors.sandBorder,
  },
  customizeButtonAccent: { borderColor: colors.reefBorder, backgroundColor: colors.reefLight },
  customizeButtonText: { fontSize: 12, color: colors.text, fontWeight: '500' },
  customizeButtonTextAccent: { color: colors.reef },

  goalsList: { marginBottom: 10, gap: 6 },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  goalCheckbox: { padding: 2 },
  goalText: { flex: 1, fontSize: 13, color: colors.text },
  goalTextCompleted: { color: colors.faint, textDecorationLine: 'line-through' },
  addGoalRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  addGoalInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.sandBorder,
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
    backgroundColor: colors.sand,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.sandDark,
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
    backgroundColor: colors.sand,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  cameraChipText: { flex: 1, fontSize: 13, color: colors.text },
  addCameraRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  addCameraInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  addCameraButton: {
    backgroundColor: colors.deep,
    borderRadius: 8,
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: { color: colors.faint, fontSize: 13, textAlign: 'center', paddingVertical: 10 },
  galleryTile: { flex: 1 / 3, aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.sand },
  galleryImage: { width: '100%', height: '100%' },

  octopusSection: { marginTop: 18 },
  octopusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.reefBorder,
    backgroundColor: colors.reefLight,
  },
  octopusButtonText: { fontSize: 13, color: colors.reef, fontWeight: '600' },
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
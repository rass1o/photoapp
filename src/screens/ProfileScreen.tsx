import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';

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

// TEMP: swap for real unlocked-item data pulled from the currency/shop system
const FRAME_COLORS = ['#7c3aed', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981'];
const BANNER_COLORS = ['#D9E2E6', '#FDE8D9', '#E4DFF7', '#DCEEE4'];
const BADGES: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string }> = [
  { icon: 'flame-outline', label: 'streak' },
  { icon: 'star-outline', label: 'top voter' },
  { icon: 'flash-outline', label: 'early bird' },
  { icon: 'ribbon-outline', label: 'weekly winner' },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();

  const [frameIndex, setFrameIndex] = useState(0);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [badgeIndex, setBadgeIndex] = useState(0);

  const [bio, setBio] = useState('Shoots on film, mostly by accident');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState(bio);

  const cycleFrame = () => setFrameIndex((i) => (i + 1) % FRAME_COLORS.length);
  const cycleBanner = () => setBannerIndex((i) => (i + 1) % BANNER_COLORS.length);
  const cycleBadge = () => setBadgeIndex((i) => (i + 1) % BADGES.length);

  const startEditBio = () => {
    setDraftBio(bio);
    setIsEditingBio(true);
  };
  const saveBio = () => {
    setBio(draftBio.trim() || bio);
    setIsEditingBio(false);
  };

  const activeBadge = BADGES[badgeIndex];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: BANNER_COLORS[bannerIndex] }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={cycleFrame}
          style={[styles.avatar, { borderColor: FRAME_COLORS[frameIndex] }]}
        >
          <Text style={styles.avatarInitials}>
            {(user?.username ?? 'M K').slice(0, 2).toUpperCase()}
          </Text>
        </Pressable>

        <Text style={styles.username}>{user?.username ?? 'maya.k'}</Text>

        {isEditingBio ? (
          <View style={styles.bioEditRow}>
            <TextInput
              style={styles.bioInput}
              value={draftBio}
              onChangeText={setDraftBio}
              autoFocus
              maxLength={80}
            />
            <Pressable onPress={saveBio} style={styles.bioSaveButton}>
              <Ionicons name="checkmark" size={16} color="#ffffff" />
            </Pressable>
          </View>
        ) : (
          <Text style={styles.bio}>{bio}</Text>
        )}

        <Pressable style={styles.streakPill} onPress={cycleBadge}>
          <Ionicons name={activeBadge.icon} size={13} color="#92400e" />
          <Text style={styles.streakText}>14 week streak · {activeBadge.label}</Text>
        </Pressable>
      </View>

      <View style={styles.sheet}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>6</Text>
            <Text style={styles.statLabel}>wins</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>1,240</Text>
            <Text style={styles.statLabel}>shutters</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>#12</Text>
            <Text style={styles.statLabel}>global rank</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Customize</Text>
        <View style={styles.customizeGrid}>
          <CustomizeButton icon="ellipse-outline" label="Avatar frame" onPress={cycleFrame} />
          <CustomizeButton icon="image-outline" label="Banner" onPress={cycleBanner} />
          <CustomizeButton icon="ribbon-outline" label="Badge" onPress={cycleBadge} />
          <CustomizeButton icon="create-outline" label="Edit bio" onPress={startEditBio} accent />
        </View>

        <Text style={styles.sectionLabel}>Trophy case</Text>
        <View style={styles.trophyGrid}>
          {[1, 2, 3, 4, 5].map((n) => (
            <View key={n} style={styles.trophyTile}>
              <Ionicons name="image-outline" size={20} color="#9ca3af" />
              {n === 1 && <Ionicons name="trophy" size={12} color="#b45309" style={styles.crownBadge} />}
            </View>
          ))}
          <View style={styles.trophyMore}>
            <Text style={styles.trophyMoreText}>+18</Text>
          </View>
        </View>

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <Ionicons name="log-out-outline" size={16} color="#b91c1c" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
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
  },
  avatarInitials: { fontSize: 18, fontWeight: '600', color: '#6d28d9' },
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
  bioSaveButton: {
    backgroundColor: '#0B1418',
    borderRadius: 6,
    padding: 8,
  },
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

  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 8 },

  customizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
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

  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trophyTile: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownBadge: { position: 'absolute', top: 4, right: 4 },
  trophyMore: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyMoreText: { fontSize: 12, color: '#9ca3af' },

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

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

type Profile = {
  id: string;
  username: string;
  bio: string;
  avatar_frame_color: string;
  banner_color: string;
  badge: string;
  streak_count: number;
  currency_balance: number;
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

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [draftBio, setDraftBio] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        if (!error && data) setProfile(data);
        setIsLoading(false);
      });
  }, [user]);

  const updateProfile = async (changes: Partial<Profile>) => {
    if (!user || !profile) return;
    // Optimistic update — reflect the change immediately, persist in the background
    setProfile({ ...profile, ...changes });
    const { error } = await supabase.from('profiles').update(changes).eq('id', user.id);
    if (error) console.log('Profile update failed:', error.message);
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

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: profile.banner_color }]} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={cycleFrame}
          style={[styles.avatar, { borderColor: profile.avatar_frame_color }]}
        >
          <Text style={styles.avatarInitials}>{profile.username.slice(0, 2).toUpperCase()}</Text>
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
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.streak_count}</Text>
            <Text style={styles.statLabel}>streak</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{profile.currency_balance}</Text>
            <Text style={styles.statLabel}>shutters</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Customize</Text>
        <View style={styles.customizeGrid}>
          <CustomizeButton icon="ellipse-outline" label="Avatar frame" onPress={cycleFrame} />
          <CustomizeButton icon="image-outline" label="Banner" onPress={cycleBanner} />
          <CustomizeButton icon="ribbon-outline" label="Badge" onPress={cycleBadge} />
          <CustomizeButton icon="create-outline" label="Edit bio" onPress={startEditBio} accent />
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
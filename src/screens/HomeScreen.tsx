import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// TEMP: replace with a real submissions table fetch from Supabase
const MOCK_THEME = 'Golden hour';
const MOCK_SUBMISSIONS = [
  { id: '1', username: 'jmiller', streak: 14 },
  { id: '2', username: 'nadia.exposures', streak: 6 },
];

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.appName}>Frames</Text>
        <View style={styles.topBarIcons}>
          <View style={styles.currencyPill}>
            <Ionicons name="flash-outline" size={13} color="#1A2A32" />
            <Text style={styles.currencyText}>1,240</Text>
          </View>
          <Ionicons name="search-outline" size={20} color="#1A2A32" style={styles.icon} />
          <Ionicons name="notifications-outline" size={20} color="#1A2A32" style={styles.icon} />
        </View>
      </View>

      {/* Centered theme banner */}
      <View style={styles.themeBanner}>
        <Text style={styles.themeLabel}>THIS WEEK'S THEME</Text>
        <Text style={styles.themeName}>{MOCK_THEME}</Text>
        <Text style={styles.themeCountdown}>Voting ends in 2d 6h</Text>
      </View>

      {/* Digital / Film toggle */}
      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, styles.toggleActive]}>
          <Text style={styles.toggleTextActive}>Digital</Text>
        </Pressable>
        <Pressable style={styles.toggle}>
          <Text style={styles.toggleText}>Film</Text>
        </Pressable>
      </View>

      {/* Feed */}
      <FlatList
        style={styles.feedSheet}
        data={MOCK_SUBMISSIONS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.avatar} />
              <Text style={styles.username}>{item.username}</Text>
              <Text style={styles.streak}>· {item.streak} day streak</Text>
              <Ionicons name="ellipsis-horizontal" size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
            </View>

            {/* Filler image placeholder */}
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={32} color="#9ca3af" />
            </View>

            <View style={styles.actionsRow}>
              <View style={styles.actionItem}>
                <Ionicons name="heart-outline" size={18} color="#4b5563" />
                <Text style={styles.actionText}>128</Text>
              </View>
              <View style={styles.actionItem}>
                <Ionicons name="chatbubble-outline" size={17} color="#4b5563" />
                <Text style={styles.actionText}>9</Text>
              </View>
              <Pressable style={styles.actionItem}>
                <Ionicons name="rocket-outline" size={17} color="#4b5563" />
                <Text style={styles.actionText}>Boost</Text>
              </Pressable>
              <Ionicons name="share-outline" size={18} color="#4b5563" style={{ marginLeft: 'auto' }} />
            </View>
          </View>
        )}
      />

      {/* Bottom tab bar is provided by the navigator; this is just the icon set reference */}
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
  topBarIcons: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { marginLeft: 2 },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  currencyText: { fontSize: 11, fontWeight: '600', color: '#1A2A32' },

  themeBanner: { alignItems: 'center', paddingVertical: 16 },
  themeLabel: { fontSize: 11, color: '#46606B', letterSpacing: 0.5, marginBottom: 4 },
  themeName: { fontSize: 26, fontWeight: '700', color: '#0B1418' },
  themeCountdown: { fontSize: 12, color: '#46606B', marginTop: 6 },

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
  card: { paddingHorizontal: 16, paddingTop: 14 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#dbeafe' },
  username: { fontSize: 14, fontWeight: '600', color: '#111827' },
  streak: { fontSize: 12, color: '#9ca3af' },
  imagePlaceholder: {
    width: '100%',
    height: 220,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: '#4b5563' },
});

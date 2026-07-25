import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const MOCK_LEADERS = [
  { id: '1', rank: 1, username: 'devonshoots', votes: 842 },
  { id: '2', rank: 2, username: 'lensflarelou', votes: 790 },
  { id: '3', rank: 3, username: 'nadia.exposures', votes: 701 },
];

export default function RankingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Rankings</Text>
      <FlatList
        data={MOCK_LEADERS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>{item.rank}</Text>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={styles.votes}>{item.votes} votes</Text>
          </View>
        )}
      />
      <View style={styles.youRow}>
        <Text style={styles.youText}>#12 · maya.k (you) · 312 votes</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  rank: { width: 24, fontWeight: '600', color: '#6b7280' },
  username: { flex: 1, fontSize: 14 },
  votes: { fontSize: 13, color: '#6b7280' },
  youRow: { marginTop: 12, backgroundColor: '#eef2ff', borderRadius: 8, padding: 10 },
  youText: { color: '#4f46e5', fontWeight: '500', fontSize: 13 },
});

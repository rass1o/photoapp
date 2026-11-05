import { View, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyVotes, OVERALL, VoteCategory } from '../lib/voting';
import { Text } from './Themed';
import { colors, bubbly } from '../theme';

type Props = {
  submissionId: string | null; // null = closed
  username: string;
  categories: VoteCategory[];
  mine: MyVotes;
  timeLeft: string; // e.g. "5h 12m"
  onToggle: (submissionId: string, category: string) => void;
  onClose: () => void;
};

// Pick which of your votes this photo gets: your overall favorite and/or
// any of the categories. Each category has one vote, so picking it here
// moves it off whatever photo had it.
export default function VoteSheet({ submissionId, username, categories, mine, timeLeft, onToggle, onClose }: Props) {
  const rows = [OVERALL, ...categories];
  const used = rows.filter((c) => mine[c.id]).length;

  return (
    <Modal visible={!!submissionId} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Vote for {username}{'’'}s photo</Text>
            <Text style={styles.subtitle}>
              {used} of {rows.length} votes used {'·'} voting ends in {timeLeft}
            </Text>
          </View>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.muted} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {submissionId &&
            rows.map((c) => {
              const here = mine[c.id] === submissionId;
              const elsewhere = !!mine[c.id] && !here;
              const overall = c.id === 'overall';
              return (
                <Pressable
                  key={c.id}
                  style={({ pressed }) => [styles.row, here && styles.rowPicked, overall && styles.rowOverall, pressed && { opacity: 0.8 }]}
                  onPress={() => onToggle(submissionId, c.id)}
                >
                  <View style={[styles.icon, here && styles.iconPicked]}>
                    <Ionicons
                      name={c.icon as keyof typeof Ionicons.glyphMap}
                      size={18}
                      color={here ? colors.white : overall ? '#B45309' : colors.reef}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>{c.label}</Text>
                    {elsewhere && <Text style={styles.note}>Your vote is on another photo</Text>}
                  </View>
                  <View style={[styles.action, here && styles.actionPicked]}>
                    <Text style={[styles.actionText, here && styles.actionTextPicked]}>
                      {here ? 'Voted' : elsewhere ? 'Move here' : 'Vote'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        </ScrollView>
        <Text style={styles.footer}>Tap a pick again to take it back. Prizes go to the overall top 5 and each category{'’'}s winner.</Text>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop },
  sheet: { backgroundColor: colors.shell, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 8, maxHeight: '80%' },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.sandDark, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  title: { ...bubbly, fontSize: 20 },
  subtitle: { fontSize: 12, color: colors.muted, marginTop: 2 },
  list: { gap: 8, paddingBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.sand,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowOverall: { borderColor: '#F59E0B' },
  rowPicked: { backgroundColor: colors.reefLight, borderColor: colors.reef },
  icon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.shell, alignItems: 'center', justifyContent: 'center' },
  iconPicked: { backgroundColor: colors.reef },
  label: { fontSize: 15, fontWeight: '600', color: colors.ink },
  note: { fontSize: 11, color: colors.muted, marginTop: 1 },
  action: { borderRadius: 14, borderWidth: 1, borderColor: colors.deep, paddingHorizontal: 12, paddingVertical: 5 },
  actionPicked: { backgroundColor: colors.deep },
  actionText: { fontSize: 12, fontWeight: '700', color: colors.deep },
  actionTextPicked: { color: colors.white },
  footer: { fontSize: 11, color: colors.muted, textAlign: 'center', marginVertical: 10 },
});

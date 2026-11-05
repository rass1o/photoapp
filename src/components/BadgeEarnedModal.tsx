import { View, StyleSheet, Modal, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ShopItem } from '../lib/shop';
import { Text } from './Themed';
import { colors, bubbly } from '../theme';

// Pops up when you've earned new badges, with a shortcut to wear one
export default function BadgeEarnedModal({
  badges,
  onWear,
  onClose,
}: {
  badges: ShopItem[];
  onWear: (badge: ShopItem) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={badges.length > 0} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.kicker}>{badges.length > 1 ? 'New badges!' : 'New badge!'}</Text>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeRow}>
              <View style={styles.badgeIcon}>
                <Ionicons name={b.value as keyof typeof Ionicons.glyphMap} size={26} color="#92400e" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeName}>{b.label}</Text>
                {b.unlock_hint ? <Text style={styles.badgeHint}>{b.unlock_hint}</Text> : null}
              </View>
            </View>
          ))}
          <Pressable
            style={styles.wearButton}
            onPress={() => {
              onWear(badges[badges.length - 1]);
              onClose();
            }}
          >
            <Text style={styles.wearText}>
              Wear {badges.length > 1 ? badges[badges.length - 1].label : 'it'} on my profile
            </Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.laterButton}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', backgroundColor: colors.shell, borderRadius: 18, padding: 20, borderWidth: 3, borderColor: '#F59E0B' },
  kicker: { ...bubbly, fontSize: 26, textAlign: 'center', marginBottom: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fef3c7',
    borderWidth: 2,
    borderColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: { fontSize: 17, fontWeight: '700', color: colors.ink },
  badgeHint: { fontSize: 12, color: colors.muted },
  wearButton: { backgroundColor: colors.deep, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  wearText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  laterButton: { alignItems: 'center', paddingTop: 12 },
  laterText: { fontSize: 13, color: colors.muted },
});

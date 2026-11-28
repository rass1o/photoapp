import { View, StyleSheet, Modal, Image, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { artColors, colors, bubbly } from '../theme';

type Props = {
  visible: boolean;
  themeName: string;
  overview?: string | null; // what the theme is about, from themes.overview
  exampleImageUrl?: string | null;
  onClose: () => void;
};

// Shown once when a new weekly theme starts: its name, an example photo and
// a short overview of the idea, so everyone knows what to go out and shoot
export default function ThemeWelcomeModal({ visible, themeName, overview, exampleImageUrl, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New theme</Text>
            <Text style={styles.themeName}>"{themeName}"</Text>
          </View>

          {exampleImageUrl ? (
            <Image source={{ uri: exampleImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.iconPlaceholder}>
              <Ionicons name="camera" size={48} color={colors.muted} />
            </View>
          )}

          {overview ? (
            <View style={styles.overview}>
              <View style={styles.overviewHeader}>
                <Ionicons name="bulb-outline" size={16} color={colors.sea} />
                <Text style={styles.overviewTitle}>About this theme</Text>
              </View>
              <Text style={styles.overviewText}>{overview}</Text>
            </View>
          ) : null}

          <View style={styles.goodLuckWrap}>
            <Text style={styles.goodLuckText}>Good luck out there. 🍀</Text>
            <Text style={styles.goodLuckSubtext}>Can't wait to see what you capture this week.</Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Let's go</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: artColors.deep }, // stays deep navy in dark mode
  scrollContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: colors.white },
  themeName: {
    ...bubbly,
    fontSize: 32,
    color: colors.white,
    textShadowColor: colors.reef,
    marginTop: 8,
    textAlign: 'center',
  },
  image: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    backgroundColor: colors.abyss,
    marginBottom: 20,
  },
  iconPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: colors.abyss,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  overview: {
    width: '100%',
    backgroundColor: colors.abyss,
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
  },
  overviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  overviewTitle: { fontSize: 13, fontWeight: '700', color: colors.sea, letterSpacing: 0.3 },
  overviewText: { fontSize: 15, lineHeight: 22, color: colors.white },
  goodLuckWrap: { alignItems: 'center', marginTop: 12 },
  goodLuckText: { fontSize: 18, fontWeight: '700', color: colors.white },
  goodLuckSubtext: { fontSize: 13, color: colors.faint, marginTop: 6, textAlign: 'center' },
  footer: { alignItems: 'center', paddingBottom: 40, paddingTop: 10 },
  closeButton: { backgroundColor: colors.shell, borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12 },
  closeButtonText: { fontSize: 14, fontWeight: '700', color: colors.deep },
});
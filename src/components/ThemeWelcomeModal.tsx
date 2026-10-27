import { View, Text, StyleSheet, Modal, Image, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  visible: boolean;
  themeName: string;
  recommendedFilms?: string | null;
  exampleImageUrl?: string | null;
  onClose: () => void;
};

const SPROCKET_COUNT = 5;

export default function ThemeWelcomeModal({
  visible,
  themeName,
  recommendedFilms,
  exampleImageUrl,
  onClose,
}: Props) {
  const filmList = (recommendedFilms ?? '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.headerTitle}>New theme</Text>
            <Text style={styles.themeName}>"{themeName}"</Text>
          </View>

          {exampleImageUrl ? (
            <Image source={{ uri: exampleImageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={styles.iconPlaceholder}>
              <Ionicons name="camera" size={48} color="#6b7280" />
            </View>
          )}

          {filmList.length > 0 ? (
            <View style={styles.filmsSection}>
              <View style={styles.filmsSectionHeader}>
                <Ionicons name="film" size={16} color="#9ca3af" />
                <Text style={styles.filmsSectionTitle}>Film recommendations</Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filmStripRow}
              >
                {filmList.map((film, i) => (
                  <View key={`${film}-${i}`} style={styles.filmCard}>
                    <View style={styles.sprocketRow}>
                      {Array.from({ length: SPROCKET_COUNT }).map((_, j) => (
                        <View key={j} style={styles.sprocketHole} />
                      ))}
                    </View>
                    <View style={styles.filmCardBody}>
                      <Text style={styles.filmFrameNumber}>{String(i + 1).padStart(2, '0')}</Text>
                      <Text style={styles.filmCardText}>{film}</Text>
                    </View>
                    <View style={styles.sprocketRow}>
                      {Array.from({ length: SPROCKET_COUNT }).map((_, j) => (
                        <View key={j} style={styles.sprocketHole} />
                      ))}
                    </View>
                  </View>
                ))}
              </ScrollView>

              <Text style={styles.filmsTip}>
                Shooting digital? Switch to monochrome mode or desaturate in post.
              </Text>
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
  container: { flex: 1, backgroundColor: '#0B1418' },
  scrollContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 20 },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 20 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  themeName: { fontSize: 24, fontWeight: '700', color: '#ffffff', marginTop: 8, textAlign: 'center' },
  image: {
    width: '100%',
    height: 280,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    marginBottom: 20,
  },
  iconPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    backgroundColor: '#1f2937',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  filmsSection: { width: '100%', marginBottom: 20 },
  filmsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  filmsSectionTitle: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  filmStripRow: { gap: 12, paddingRight: 8, paddingVertical: 2 },
  filmCard: {
    width: 136,
    backgroundColor: '#000000',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2d2d2d',
    paddingVertical: 6,
    overflow: 'hidden',
  },
  sprocketRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  sprocketHole: {
    width: 7,
    height: 7,
    borderRadius: 1.5,
    backgroundColor: '#3a3a3a',
  },
  filmCardBody: {
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#2d2d2d',
  },
  filmFrameNumber: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 1,
  },
  filmCardText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'center',
  },
  filmsTip: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 10,
    textAlign: 'center',
  },
  goodLuckWrap: { alignItems: 'center', marginTop: 12 },
  goodLuckText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  goodLuckSubtext: { fontSize: 13, color: '#9ca3af', marginTop: 6, textAlign: 'center' },
  footer: { alignItems: 'center', paddingBottom: 40, paddingTop: 10 },
  closeButton: { backgroundColor: '#ffffff', borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12 },
  closeButtonText: { fontSize: 14, fontWeight: '700', color: '#0B1418' },
});
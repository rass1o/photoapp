import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CameraScreen() {
  // TODO: wire up expo-image-picker or expo-camera here
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Submit for "Golden hour"</Text>
      <Text style={styles.subtitle}>0 of 1 submissions used this week</Text>

      <Pressable style={styles.captureButton}>
        <Text style={styles.captureText}>Take or choose a photo</Text>
      </Pressable>

      <View style={styles.toggleRow}>
        <Pressable style={[styles.toggle, styles.toggleActive]}>
          <Text style={styles.toggleTextActive}>Digital</Text>
        </Pressable>
        <Pressable style={styles.toggle}>
          <Text style={styles.toggleText}>Film</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  captureButton: {
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  captureText: { color: '#6b7280', fontSize: 14 },
  toggleRow: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' },
  toggle: { flex: 1, padding: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#f3f4f6' },
  toggleText: { color: '#6b7280', fontSize: 13 },
  toggleTextActive: { fontWeight: '600', fontSize: 13 },
});

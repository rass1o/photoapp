import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

type Theme = {
  id: string;
  name: string;
};

export default function CameraScreen() {
  const { user } = useAuth();
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadTheme = async () => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from('themes')
        .select('id, name')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      setTheme(data);
      setIsLoadingTheme(false);
    };

    loadTheme();
  }, []);

  const pickImage = async () => {
    const permission = await ImagePicker.getMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      if (!permission.canAskAgain) {
        Alert.alert(
          'Photo access needed',
          'Enable photo access for Expo Go in Settings to submit a photo.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      const requested = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!requested.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to submit a photo.');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 5],
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || !user || !theme) return;
    setIsUploading(true);

    try {
      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = imageUri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('submissions')
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('submissions').insert({
        user_id: user.id,
        theme_id: theme.id,
        image_url: publicUrlData.publicUrl,
        format,
      });

      if (insertError) throw insertError;

      Alert.alert('Submitted!', 'Your photo is live for this week\u2019s theme.');
      setImageUri(null);
    } catch (err) {
      console.log('Submission failed:', err);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoadingTheme) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#0B1418" />
      </SafeAreaView>
    );
  }

  if (!theme) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>No active theme right now</Text>
        <Text style={styles.subtitle}>Check back once this week's theme is live.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Submit for "{theme.name}"</Text>
      <Text style={styles.subtitle}>0 of 1 submissions used this week</Text>

      <Pressable style={styles.captureButton} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.preview} />
        ) : (
          <Text style={styles.captureText}>Take or choose a photo</Text>
        )}
      </Pressable>

      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggle, format === 'digital' && styles.toggleActive]}
          onPress={() => setFormat('digital')}
        >
          <Text style={format === 'digital' ? styles.toggleTextActive : styles.toggleText}>
            Digital
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggle, format === 'film' && styles.toggleActive]}
          onPress={() => setFormat('film')}
        >
          <Text style={format === 'film' ? styles.toggleTextActive : styles.toggleText}>
            Film
          </Text>
        </Pressable>
      </View>

      <Pressable
        style={[styles.submitButton, (!imageUri || isUploading) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!imageUri || isUploading}
      >
        {isUploading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Submit</Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  subtitle: { fontSize: 13, color: '#6b7280', marginBottom: 20 },
  captureButton: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#9ca3af',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  captureText: { color: '#6b7280', fontSize: 14 },
  preview: { width: '100%', height: '100%' },
  toggleRow: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden', marginBottom: 16 },
  toggle: { flex: 1, padding: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: '#f3f4f6' },
  toggleText: { color: '#6b7280', fontSize: 13 },
  toggleTextActive: { fontWeight: '600', fontSize: 13 },
  submitButton: {
    backgroundColor: '#0B1418',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});
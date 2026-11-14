import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Image, Alert, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Text, TextInput } from './Themed';
import { Sheet, sheetStyles } from './GroupSheets';
import { colors } from '../theme';
import { supabase } from '../lib/supabase';
import { readImage, type ImageUpload } from '../lib/upload';
import { alertBlockedPhoto, assertImageAppropriate, ModerationError } from '../lib/moderation';
import { GroupTheme } from '../lib/groups';

// Posting your photo to a group theme: pick it, say how it was shot, add a
// caption. It goes through the same content check as every other photo.

type Props = {
  visible: boolean;
  theme: GroupTheme;
  userId: string;
  onClose: () => void;
  onPosted: () => void;
};

async function ensurePermission(source: 'camera' | 'library') {
  const isCamera = source === 'camera';
  const current = isCamera ? await ImagePicker.getCameraPermissionsAsync() : await ImagePicker.getMediaLibraryPermissionsAsync();
  if (current.status === 'granted') return true;
  if (!current.canAskAgain) {
    Alert.alert(`${isCamera ? 'Camera' : 'Photo'} access needed`, `Turn on ${isCamera ? 'camera' : 'photo'} access in Settings to post a photo.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
    return false;
  }
  const asked = isCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  return asked.granted;
}

export default function GroupPostSheet({ visible, theme, userId, onClose, onPosted }: Props) {
  const [uri, setUri] = useState<string | null>(null);
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setUri(null);
      setFormat('digital');
      setCaption('');
    }
  }, [visible]);

  const pick = async (source: 'camera' | 'library') => {
    if (!(await ensurePermission(source))) return;
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.8 };
    try {
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets[0]) setUri(result.assets[0].uri);
    } catch {
      Alert.alert('Camera unavailable', 'Choose a photo from your library instead.');
    }
  };

  const post = async () => {
    if (!uri) return;
    setBusy(true);
    let image: ImageUpload | undefined;
    try {
      image = await readImage(uri);
      await assertImageAppropriate(image.bytes, image.contentType);
      const filePath = `${userId}/group-${Date.now()}.${image.ext}`;
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, image.bytes, { contentType: image.contentType });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const { error } = await supabase.from('group_submissions').insert({
        group_theme_id: theme.id,
        group_id: theme.group_id,
        user_id: userId,
        image_url: publicUrlData.publicUrl,
        format,
        caption: caption.trim(),
      });
      if (error) {
        throw new Error(error.code === '23505' ? 'You’ve already posted a photo for this theme.' : 'Photos for this theme may have closed. Pull down to refresh.');
      }
      onPosted();
    } catch (err) {
      if (err instanceof ModerationError && image) {
        alertBlockedPhoto(err, image, userId, {
          kind: 'group',
          group_theme_id: theme.id,
          format,
          caption: caption.trim(),
          film_strip: true,
        });
      } else {
        console.log('Group post failed:', err);
        Alert.alert('Couldn’t post your photo', err instanceof Error ? err.message : 'Please try again.');
      }
    }
    setBusy(false);
  };

  return (
    <Sheet visible={visible} title={theme.name} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        {uri ? (
          <Pressable onPress={() => setUri(null)}>
            <Image source={{ uri }} style={styles.preview} />
            <Text style={styles.change}>Tap to choose a different photo</Text>
          </Pressable>
        ) : (
          <View style={styles.sources}>
            <Pressable style={styles.source} onPress={() => pick('camera')}>
              <Ionicons name="camera" size={26} color={colors.deep} />
              <Text style={styles.sourceText}>Take photo</Text>
            </Pressable>
            <Pressable style={styles.source} onPress={() => pick('library')}>
              <Ionicons name="images" size={26} color={colors.deep} />
              <Text style={styles.sourceText}>Choose from library</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.formatRow}>
          {(['digital', 'film'] as const).map((f) => (
            <Pressable key={f} style={[styles.formatChip, format === f && styles.formatChipActive]} onPress={() => setFormat(f)}>
              <Ionicons name={f === 'film' ? 'film-outline' : 'camera-outline'} size={14} color={format === f ? colors.white : colors.deep} />
              <Text style={[styles.formatText, format === f && styles.formatTextActive]}>{f === 'film' ? 'Film' : 'Digital'}</Text>
            </Pressable>
          ))}
        </View>

        <TextInput style={sheetStyles.input} placeholder="Caption (optional)" value={caption} onChangeText={setCaption} maxLength={300} />

        <Pressable style={[sheetStyles.primaryButton, (!uri || busy) && sheetStyles.disabled]} onPress={post} disabled={!uri || busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={sheetStyles.primaryText}>Post to the group</Text>}
        </Pressable>
        <Text style={[sheetStyles.hint, styles.center]}>Group photos are only seen by the group.</Text>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 20 },
  sources: { flexDirection: 'row', gap: 10 },
  source: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.sand,
    borderRadius: 14,
    paddingVertical: 26,
  },
  sourceText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  preview: { width: '100%', aspectRatio: 1, borderRadius: 14, backgroundColor: colors.sand },
  change: { textAlign: 'center', fontSize: 12, color: colors.muted, marginTop: 6 },
  formatRow: { flexDirection: 'row', gap: 8 },
  formatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.deep,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  formatChipActive: { backgroundColor: colors.deep },
  formatText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  formatTextActive: { color: colors.white },
  center: { textAlign: 'center' },
});

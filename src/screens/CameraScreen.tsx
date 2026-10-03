import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
  TextInput,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import SectionHeader from '../components/SectionHeader';

type Theme = {
  id: string;
  name: string;
};

const DAILY_SUBMISSION_REWARD = 1;

const CHEAT_SHEET_ROWS = [
  { setting: 'Wide aperture (f/1.8–f/2.8)', effect: 'Blurry background, more light in — good for portraits, low light' },
  { setting: 'Narrow aperture (f/8–f/16)', effect: 'Everything in focus, less light in — good for landscapes' },
  { setting: 'Fast shutter (1/500s+)', effect: 'Freezes motion — good for sports, kids, pets' },
  { setting: 'Slow shutter (1/30s or slower)', effect: 'Motion blur, needs a steady hand or tripod — good for light trails, water' },
  { setting: 'Low ISO (100–400)', effect: 'Cleaner image, needs more light — good outdoors in daylight' },
  { setting: 'High ISO (1600+)', effect: 'Brighter in the dark, but grainier — good indoors or at night' },
];

export default function CameraScreen() {
  const { user } = useAuth();

  // Weekly (main) submission state
  const [theme, setTheme] = useState<Theme | null>(null);
  const [isLoadingTheme, setIsLoadingTheme] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [format, setFormat] = useState<'digital' | 'film'>('digital');
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Daily freelance photo state (no theme — just whatever you're up to, like BeReal)
  const [isCheckingDaily, setIsCheckingDaily] = useState(true);
  const [dailyAlreadySubmitted, setDailyAlreadySubmitted] = useState(false);
  const [dailyImageUri, setDailyImageUri] = useState<string | null>(null);
  const [isUploadingDaily, setIsUploadingDaily] = useState(false);

  const [cheatSheetVisible, setCheatSheetVisible] = useState(false);

  const checkExistingSubmission = async (themeId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('submissions')
      .select('id')
      .eq('theme_id', themeId)
      .eq('user_id', user.id)
      .maybeSingle();
    setAlreadySubmitted(!!data);
  };

  const checkExistingDailySubmission = async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from('daily_submissions')
      .select('id')
      .eq('user_id', user.id)
      .eq('submission_date', today)
      .maybeSingle();
    setDailyAlreadySubmitted(!!data);
    setIsCheckingDaily(false);
  };

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
      if (data) await checkExistingSubmission(data.id);
      setIsLoadingTheme(false);
    };

    loadTheme();
    checkExistingDailySubmission();
  }, [user]);

  const pickImage = async (target: 'weekly' | 'daily') => {
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
    });

    if (!result.canceled && result.assets[0]) {
      if (target === 'weekly') setImageUri(result.assets[0].uri);
      else setDailyImageUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!imageUri || !user || !theme || alreadySubmitted) return;
    setIsUploading(true);

    try {
      const { data: existing } = await supabase
        .from('submissions')
        .select('id')
        .eq('theme_id', theme.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        setAlreadySubmitted(true);
        Alert.alert('Already submitted', 'You\u2019ve already submitted a photo for this theme.');
        return;
      }

      const response = await fetch(imageUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = imageUri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('submissions').insert({
        user_id: user.id,
        theme_id: theme.id,
        image_url: publicUrlData.publicUrl,
        format,
        caption: caption.trim(),
      });

      if (insertError) throw insertError;

      setAlreadySubmitted(true);
      setImageUri(null);
      setCaption('');
      Alert.alert('Submitted!', 'Your photo is live for this week\u2019s theme.');
    } catch (err) {
      console.log('Submission failed:', err);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDailySubmit = async () => {
    if (!dailyImageUri || !user || dailyAlreadySubmitted) return;
    setIsUploadingDaily(true);

    try {
      const today = new Date().toISOString().slice(0, 10);

      const { data: existing } = await supabase
        .from('daily_submissions')
        .select('id')
        .eq('user_id', user.id)
        .eq('submission_date', today)
        .maybeSingle();

      if (existing) {
        setDailyAlreadySubmitted(true);
        return;
      }

      const response = await fetch(dailyImageUri);
      const arrayBuffer = await response.arrayBuffer();
      const fileExt = dailyImageUri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/daily-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, { contentType: `image/${fileExt}` });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('daily_submissions').insert({
        user_id: user.id,
        image_url: publicUrlData.publicUrl,
        submission_date: today,
      });

      if (insertError) throw insertError;

      // Update the daily streak: continue if yesterday's post exists, otherwise restart at 1
      const { data: profileData } = await supabase
        .from('profiles')
        .select('daily_streak_count, last_daily_submission_date, currency_balance')
        .eq('id', user.id)
        .single();

      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const lastDate = profileData?.last_daily_submission_date;
      const nextStreak = lastDate === yesterday ? (profileData?.daily_streak_count ?? 0) + 1 : 1;

      await supabase
        .from('profiles')
        .update({
          daily_streak_count: nextStreak,
          last_daily_submission_date: today,
          currency_balance: (profileData?.currency_balance ?? 0) + DAILY_SUBMISSION_REWARD,
        })
        .eq('id', user.id);

      setDailyAlreadySubmitted(true);
      setDailyImageUri(null);
      Alert.alert('Posted!', `+${DAILY_SUBMISSION_REWARD} shutter, ${nextStreak} day streak.`);
    } catch (err) {
      console.log('Daily submission failed:', err);
      Alert.alert('Something went wrong', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setIsUploadingDaily(false);
    }
  };

  if (isLoadingTheme) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={{ marginTop: 40 }} color="#0B1418" />
      </SafeAreaView>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.topRow}>
              <View />
              <Pressable style={styles.cheatSheetButton} onPress={() => setCheatSheetVisible(true)}>
                <Ionicons name="book-outline" size={14} color="#4f46e5" />
                <Text style={styles.cheatSheetButtonText}>Cheat sheet</Text>
              </Pressable>
            </View>

            {/* ---------- Weekly submission (main) ---------- */}
            {!theme ? (
              <View style={styles.section}>
                <Text style={styles.title}>No active theme right now</Text>
                <Text style={styles.subtitle}>Check back once this week's theme is live.</Text>
              </View>
            ) : alreadySubmitted ? (
              <View style={styles.section}>
                <View style={styles.doneWrap}>
                  <Text style={styles.doneTitle}>You're all set</Text>
                  <Text style={styles.doneSubtitle}>
                    Your submission is in for "{theme.name}". Check the Home tab to see it in the feed.
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.title}>Submit for "{theme.name}"</Text>
                <Text style={styles.subtitle}>1 submission allowed per theme</Text>

                <Pressable style={styles.captureButton} onPress={() => pickImage('weekly')}>
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

                <View>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption (optional)"
                    placeholderTextColor="#9ca3af"
                    value={caption}
                    onChangeText={setCaption}
                    maxLength={140}
                    multiline
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                  <Pressable onPress={Keyboard.dismiss} style={styles.doneButton}>
                    <Text style={styles.doneButtonText}>Done</Text>
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
              </View>
            )}

            {/* ---------- Daily freelance photo (secondary) ---------- */}
            <View style={styles.dailySection}>
              <SectionHeader icon="sunny-outline" label="Daily photo" />

              {isCheckingDaily ? (
                <ActivityIndicator color="#0B1418" style={{ marginTop: 10 }} />
              ) : dailyAlreadySubmitted ? (
                <View style={styles.dailyDoneRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#166534" />
                  <Text style={styles.dailyDoneText}>Posted for today — see you tomorrow</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.dailySubtitle}>
                    No theme, no pressure — just a photo of whatever you're up to, visible to
                    everyone. +{DAILY_SUBMISSION_REWARD} shutter and keeps your daily streak going.
                  </Text>

                  <Pressable style={styles.dailyCaptureButton} onPress={() => pickImage('daily')}>
                    {dailyImageUri ? (
                      <Image source={{ uri: dailyImageUri }} style={styles.preview} />
                    ) : (
                      <Text style={styles.captureText}>Take or choose a photo</Text>
                    )}
                  </Pressable>

                  <Pressable
                    style={[
                      styles.dailySubmitButton,
                      (!dailyImageUri || isUploadingDaily) && styles.submitButtonDisabled,
                    ]}
                    onPress={handleDailySubmit}
                    disabled={!dailyImageUri || isUploadingDaily}
                  >
                    {isUploadingDaily ? (
                      <ActivityIndicator color="#ffffff" />
                    ) : (
                      <Text style={styles.submitText}>Post daily photo</Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <Modal
          visible={cheatSheetVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setCheatSheetVisible(false)}
        >
          <View style={styles.cheatSheetBackdrop}>
            <View style={styles.cheatSheetCard}>
              <View style={styles.cheatSheetHeader}>
                <Text style={styles.cheatSheetTitle}>Exposure cheat sheet</Text>
                <Pressable onPress={() => setCheatSheetVisible(false)}>
                  <Ionicons name="close" size={22} color="#374151" />
                </Pressable>
              </View>
              <ScrollView>
                <Text style={styles.cheatSheetIntro}>
                  Three settings control exposure together — aperture, shutter speed, and ISO.
                  Quick reference for what each one does:
                </Text>
                {CHEAT_SHEET_ROWS.map((row, i) => (
                  <View key={i} style={styles.cheatSheetRow}>
                    <Text style={styles.cheatSheetSetting}>{row.setting}</Text>
                    <Text style={styles.cheatSheetEffect}>{row.effect}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  cheatSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eef2ff',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cheatSheetButtonText: { fontSize: 12, fontWeight: '600', color: '#4f46e5' },
  section: {},
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
  captionInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  doneButton: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 },
  doneButtonText: { fontSize: 12, color: '#4f46e5', fontWeight: '600' },
  submitButton: {
    backgroundColor: '#0B1418',
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  doneWrap: { paddingVertical: 40 },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  doneSubtitle: { fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },

  dailySection: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: '#f3f4f6',
  },
  dailySubtitle: { fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 17 },
  dailyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  dailyDoneText: { fontSize: 13, color: '#166534' },
  dailyCaptureButton: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  dailySubmitButton: {
    backgroundColor: '#92400e',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },

  cheatSheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  cheatSheetCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '75%',
  },
  cheatSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cheatSheetTitle: { fontSize: 16, fontWeight: '600' },
  cheatSheetIntro: { fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 17 },
  cheatSheetRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6' },
  cheatSheetSetting: { fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 3 },
  cheatSheetEffect: { fontSize: 12, color: '#6b7280', lineHeight: 17 },
});
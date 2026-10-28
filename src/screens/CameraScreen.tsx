import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Linking,
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
import { readImageFile, imageContentType } from '../lib/upload';
import { localDateString } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import { useFocusEffect } from '@react-navigation/native';
import { ShopItem, isOwned, loadShop } from '../lib/shop';
import FilmStamp from '../components/FilmStamp';
import SectionHeader from '../components/SectionHeader';
import { Text, TextInput } from '../components/Themed';
import { colors, bubbly } from '../theme';

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
  const [ownedStamps, setOwnedStamps] = useState<ShopItem[]>([]);
  const [filmStamp, setFilmStamp] = useState<string | null>(null);

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
    const today = localDateString();
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
  }, [user]);

  // Refresh on focus so stamps bought in the Shop show up right away, and so
  // the daily photo unlocks again after local midnight without a restart
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      checkExistingDailySubmission();
      loadShop(user.id).then(({ items, ownedIds }) =>
        setOwnedStamps(items.filter((i) => i.category === 'stamp' && isOwned(i, ownedIds)))
      );
    }, [user])
  );

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

      const arrayBuffer = await readImageFile(imageUri);
      const fileExt = imageUri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, { contentType: imageContentType(fileExt) });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('submissions').insert({
        user_id: user.id,
        theme_id: theme.id,
        image_url: publicUrlData.publicUrl,
        format,
        caption: caption.trim(),
        film_stamp: format === 'film' ? filmStamp : null,
      });

      if (insertError) throw insertError;

      setAlreadySubmitted(true);
      setImageUri(null);
      setCaption('');
      setFilmStamp(null);
      Alert.alert('Shell yeah!', 'Your photo is live for this week\u2019s theme.');
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
      const today = localDateString();

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

      const arrayBuffer = await readImageFile(dailyImageUri);
      const fileExt = dailyImageUri.split('.').pop() ?? 'jpg';
      const filePath = `${user.id}/daily-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(filePath, arrayBuffer, { contentType: imageContentType(fileExt) });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('submissions').getPublicUrl(filePath);

      const { error: insertError } = await supabase.from('daily_submissions').insert({
        user_id: user.id,
        image_url: publicUrlData.publicUrl,
        submission_date: today,
      });

      if (insertError) throw insertError;

      // Streak + reward are handled server-side so the client can't edit balances
      const { data: reward, error: rewardError } = await supabase.rpc('record_daily_post', { p_date: today });
      if (rewardError) throw rewardError;

      setDailyAlreadySubmitted(true);
      setDailyImageUri(null);
      Alert.alert('Fin-tastic!', `+${reward.reward} shutter, ${reward.streak} day streak.`);
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
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.deep} />
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
                <Ionicons name="book-outline" size={14} color={colors.reef} />
                <Text style={styles.cheatSheetButtonText}>Cheat sheet</Text>
              </Pressable>
            </View>

            {/* ---------- Weekly submission (main) ---------- */}
            {!theme ? (
              <View style={styles.section}>
                <Text style={styles.title}>No active theme right now</Text>
                <Text style={styles.subtitle}>The tide's out. Check back once this week's theme is live.</Text>
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

                {format === 'film' && (
                  <View style={styles.stampPicker}>
                    <Text style={styles.stampPickerLabel}>Film stamp</Text>
                    {ownedStamps.length === 0 ? (
                      <Text style={styles.stampPickerEmpty}>
                        Pick up film stamps in the Shop to tag the stock you shot on.
                      </Text>
                    ) : (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stampRow}>
                        <Pressable
                          style={[styles.stampOption, filmStamp === null && styles.stampOptionActive]}
                          onPress={() => setFilmStamp(null)}
                        >
                          <Text style={styles.stampNoneText}>None</Text>
                        </Pressable>
                        {ownedStamps.map((stamp) => (
                          <Pressable
                            key={stamp.id}
                            style={[styles.stampOption, filmStamp === stamp.value && styles.stampOptionActive]}
                            onPress={() => setFilmStamp(stamp.value)}
                          >
                            <FilmStamp stock={stamp.value} accent={stamp.accent} size="small" />
                          </Pressable>
                        ))}
                      </ScrollView>
                    )}
                  </View>
                )}

                <View>
                  <TextInput
                    style={styles.captionInput}
                    placeholder="Add a caption (optional)"
                    placeholderTextColor={colors.faint}
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
                    <ActivityIndicator color={colors.white} />
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
                <ActivityIndicator color={colors.deep} style={{ marginTop: 10 }} />
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
                      <ActivityIndicator color={colors.white} />
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
                  <Ionicons name="close" size={22} color={colors.text} />
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
  stampPicker: { marginBottom: 12 },
  stampPickerLabel: { fontSize: 12, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  stampPickerEmpty: { fontSize: 12, color: colors.faint },
  stampRow: { gap: 6, paddingVertical: 2 },
  stampOption: {
    borderWidth: 1,
    borderColor: colors.sandBorder,
    borderRadius: 8,
    padding: 4,
    minHeight: 32,
    justifyContent: 'center',
  },
  stampOptionActive: { borderColor: colors.deep, borderWidth: 2, padding: 3 },
  stampNoneText: { fontSize: 11, color: colors.muted, paddingHorizontal: 6 },
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 4 },
  cheatSheetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.reefLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  cheatSheetButtonText: { fontSize: 12, fontWeight: '600', color: colors.reef },
  section: {},
  title: { ...bubbly, fontSize: 24 },
  subtitle: { fontSize: 13, color: colors.muted, marginBottom: 20 },
  captureButton: {
    height: 260,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  captureText: { color: colors.muted, fontSize: 14 },
  preview: { width: '100%', height: '100%' },
  toggleRow: { flexDirection: 'row', borderRadius: 8, borderWidth: 1, borderColor: colors.sandBorder, overflow: 'hidden', marginBottom: 16 },
  toggle: { flex: 1, padding: 10, alignItems: 'center' },
  toggleActive: { backgroundColor: colors.sand },
  toggleText: { color: colors.muted, fontSize: 13 },
  toggleTextActive: { fontWeight: '600', fontSize: 13 },
  captionInput: {
    borderWidth: 1,
    borderColor: colors.sandBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  doneButton: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 12 },
  doneButtonText: { fontSize: 12, color: colors.reef, fontWeight: '600' },
  submitButton: {
    backgroundColor: colors.deep,
    borderRadius: 8,
    paddingVertical: 13,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.4 },
  submitText: { color: colors.white, fontSize: 14, fontWeight: '600' },
  doneWrap: { paddingVertical: 40 },
  doneTitle: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  doneSubtitle: { fontSize: 13, color: colors.muted, textAlign: 'center', lineHeight: 19 },

  dailySection: {
    marginTop: 24,
    paddingTop: 18,
    borderTopWidth: 1,
    borderColor: colors.sand,
  },
  dailySubtitle: { fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 },
  dailyDoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  dailyDoneText: { fontSize: 13, color: '#166534' },
  dailyCaptureButton: {
    height: 140,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.sandDark,
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

  cheatSheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  cheatSheetCard: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '75%',
  },
  cheatSheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cheatSheetTitle: { fontSize: 16, fontWeight: '600' },
  cheatSheetIntro: { fontSize: 12, color: colors.muted, marginBottom: 12, lineHeight: 17 },
  cheatSheetRow: { paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.sand },
  cheatSheetSetting: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 3 },
  cheatSheetEffect: { fontSize: 12, color: colors.muted, lineHeight: 17 },
});
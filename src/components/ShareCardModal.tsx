import { ComponentRef, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Modal,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import { Text, TextInput } from './Themed';
import { colors, bubbly } from '../theme';

// Turns a photo into a styled card (with your own message printed on it) and
// opens the phone's share sheet, so it can go to Messages, Instagram, etc.
// The card message is part of the image because many apps drop text sent
// with one; a separate text message (with a link to the app) goes alongside
// where the phone allows it.

type CardStyle = 'polaroid' | 'film' | 'postcard' | 'ocean';

const STYLES: { id: CardStyle; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'polaroid', label: 'Polaroid', icon: 'square-outline' },
  { id: 'film', label: 'Film strip', icon: 'film-outline' },
  { id: 'postcard', label: 'Postcard', icon: 'mail-outline' },
  { id: 'ocean', label: 'Ocean', icon: 'water-outline' },
];

const CARD_WIDTH = 300;
const MESSAGE_MAX = 90;
const DEFAULT_TEXT = 'Have you seen this picture?';

// Where the shared text points. Placeholder until the app is in the App
// Store; swap in the store link then. Empty = no link line.
const SHARE_LINK = 'https://shuttink.app';

type Props = {
  visible: boolean;
  imageUrl: string | null;
  username: string;
  themeName?: string | null;
  onClose: () => void;
};

function Sprockets() {
  return (
    <View style={styles.sprockets}>
      {Array.from({ length: 11 }, (_, i) => (
        <View key={i} style={styles.sprocket} />
      ))}
    </View>
  );
}

export default function ShareCardModal({ visible, imageUrl, username, themeName, onClose }: Props) {
  const cardRef = useRef<ComponentRef<typeof View>>(null);
  const [style, setStyle] = useState<CardStyle>('polaroid');
  const [message, setMessage] = useState(''); // printed on the card
  const [text, setText] = useState(DEFAULT_TEXT); // sent with the picture
  const [ratio, setRatio] = useState(1); // photo height / width
  const [loaded, setLoaded] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Fresh card for each photo
  useEffect(() => {
    if (!visible || !imageUrl) return;
    setLoaded(false);
    setMessage('');
    setText(DEFAULT_TEXT);
    Image.getSize(
      imageUrl,
      (w, h) => setRatio(Math.min(1.35, Math.max(0.75, h / w))),
      () => setRatio(1)
    );
  }, [visible, imageUrl]);

  const share = async () => {
    if (!cardRef.current || !loaded) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, { format: 'jpg', quality: 0.95, result: 'tmpfile' });
      const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
      const fullText = [text.trim(), SHARE_LINK ? `See it on ShuttInk: ${SHARE_LINK}` : ''].filter(Boolean).join('\n\n');

      if (Platform.OS === 'ios') {
        // iOS sends the picture and the text together (e.g. one iMessage)
        await Share.share({ url: fileUri, message: fullText });
        return;
      }

      // Android's share sheet here only takes the picture, so the text goes
      // on the clipboard to paste in next to it
      if (fullText) await Clipboard.setStringAsync(fullText);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert('Sharing isn’t available on this device');
        return;
      }
      await Sharing.shareAsync(fileUri, { mimeType: 'image/jpeg', dialogTitle: 'Share photo' });
    } catch (err) {
      console.log('Share card failed:', err);
      Alert.alert('Couldn’t share that', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  if (!imageUrl) return null;

  const date = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  const credit = themeName ? `${username} · ${themeName}` : username;
  const photoWidth = style === 'polaroid' ? CARD_WIDTH - 28 : style === 'film' ? CARD_WIDTH - 24 : CARD_WIDTH - 40;
  const photo = (
    <Image
      source={{ uri: imageUrl }}
      onLoad={() => setLoaded(true)}
      style={[
        { width: photoWidth, height: photoWidth * ratio },
        style === 'ocean' && styles.photoOcean,
        style === 'postcard' && styles.photoPostcard,
      ]}
    />
  );

  const renderCard = () => {
    switch (style) {
      case 'polaroid':
        return (
          <View style={styles.polaroid}>
            {photo}
            <Text style={styles.polaroidMessage}>{message || ' '}</Text>
            <View style={styles.footerRow}>
              <Text style={styles.polaroidMeta}>{credit}</Text>
              <Text style={styles.polaroidMeta}>{date}</Text>
            </View>
          </View>
        );
      case 'film':
        return (
          <View style={styles.film}>
            <Text style={styles.filmEdge}>{'▶'} 24A    SHUTTINK 400    {'▶'} 25</Text>
            <Sprockets />
            {photo}
            <Sprockets />
            {message ? <Text style={styles.filmMessage}>{message}</Text> : null}
            <Text style={styles.filmMeta}>{credit}</Text>
          </View>
        );
      case 'postcard':
        return (
          <View style={styles.postcard}>
            <View style={styles.postcardTop}>
              <Text style={styles.postcardGreeting}>Greetings from ShuttInk</Text>
              <View style={styles.stamp}>
                <Ionicons name="camera" size={16} color={colors.coral} />
              </View>
            </View>
            {photo}
            {message ? <Text style={styles.postcardMessage}>{message}</Text> : null}
            <Text style={styles.postcardMeta}>
              {credit} {'·'} {date}
            </Text>
          </View>
        );
      case 'ocean':
        return (
          <View style={styles.ocean}>
            <Text style={styles.oceanBrand}>ShuttInk</Text>
            {photo}
            {message ? (
              <View style={styles.oceanBubble}>
                <Text style={styles.oceanMessage}>{message}</Text>
              </View>
            ) : null}
            <Text style={styles.oceanMeta}>{credit}</Text>
            <View style={styles.oceanSand} />
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Share photo</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* what gets shared: captured exactly as it looks here */}
            <View ref={cardRef} collapsable={false} style={styles.cardShadow}>
              {renderCard()}
            </View>
            {!loaded && <ActivityIndicator style={styles.loading} color={colors.deep} />}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.styleRow}>
              {STYLES.map((s) => (
                <Pressable
                  key={s.id}
                  style={[styles.styleChip, style === s.id && styles.styleChipActive]}
                  onPress={() => setStyle(s.id)}
                >
                  <Ionicons name={s.icon} size={14} color={style === s.id ? colors.white : colors.deep} />
                  <Text style={[styles.styleChipText, style === s.id && styles.styleChipTextActive]}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>On the card</Text>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              maxLength={MESSAGE_MAX}
              placeholder="Add a message (it's printed on the card)"
              placeholderTextColor={colors.faint}
            />
            <Text style={styles.counter}>{MESSAGE_MAX - message.length} left</Text>

            <Text style={styles.fieldLabel}>Message to send</Text>
            <TextInput
              style={[styles.messageInput, styles.textInput]}
              value={text}
              onChangeText={setText}
              maxLength={300}
              multiline
              placeholder="Say something with the picture"
              placeholderTextColor={colors.faint}
            />
            {SHARE_LINK ? (
              <View style={styles.linkRow}>
                <Ionicons name="link-outline" size={13} color={colors.reef} />
                <Text style={styles.linkText}>See it on ShuttInk: {SHARE_LINK}</Text>
              </View>
            ) : null}
            {Platform.OS === 'android' && (
              <Text style={styles.androidNote}>
                Your message gets copied when you share, so you can paste it in next to the picture.
              </Text>
            )}

            <Pressable style={[styles.shareButton, (!loaded || sharing) && { opacity: 0.6 }]} onPress={share} disabled={!loaded || sharing}>
              {sharing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={17} color={colors.white} />
                  <Text style={styles.shareText}>Share</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { maxHeight: '92%', backgroundColor: colors.shell, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, paddingBottom: 8 },
  title: { ...bubbly, fontSize: 22 },
  body: { alignItems: 'center', paddingHorizontal: 18, paddingBottom: 32 },
  cardShadow: { marginTop: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  loading: { position: 'absolute', top: 120 },

  // Polaroid: white frame with a deep bottom edge for the message
  polaroid: { width: CARD_WIDTH, backgroundColor: '#FFFFFF', padding: 14, paddingBottom: 12 },
  polaroidMessage: { fontSize: 18, fontWeight: '500', color: colors.ink, textAlign: 'center', marginTop: 12, minHeight: 26 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  polaroidMeta: { fontSize: 11, color: colors.muted },

  // Film strip: dark film with sprocket holes and edge printing
  film: { width: CARD_WIDTH, backgroundColor: '#14161C', paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  filmEdge: { fontSize: 9, letterSpacing: 1.5, color: '#F59E0B', fontWeight: '600', alignSelf: 'flex-start', marginBottom: 4 },
  sprockets: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginVertical: 6 },
  sprocket: { width: 14, height: 9, borderRadius: 2, backgroundColor: '#E5E7EB' },
  filmMessage: { fontSize: 16, fontWeight: '500', color: '#FFF3DC', textAlign: 'center', marginTop: 8 },
  filmMeta: { fontSize: 11, color: '#9CA3AF', marginTop: 6 },

  // Postcard: sand card, tilted photo, stamp in the corner
  postcard: {
    width: CARD_WIDTH,
    backgroundColor: colors.shell,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    padding: 16,
    paddingTop: 12,
    alignItems: 'center',
  },
  postcardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch', marginBottom: 10 },
  postcardGreeting: { ...bubbly, fontSize: 18, textShadowOffset: { width: 0, height: 1 } },
  stamp: {
    width: 34,
    height: 40,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.coral,
    backgroundColor: colors.coralLight,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '6deg' }],
  },
  photoPostcard: { borderWidth: 6, borderColor: '#FFFFFF', transform: [{ rotate: '-2deg' }] },
  postcardMessage: { fontSize: 17, fontWeight: '500', color: colors.deep, textAlign: 'center', marginTop: 14 },
  postcardMeta: { fontSize: 11, color: colors.muted, marginTop: 8 },

  // Ocean: sea backdrop, rounded photo, a speech bubble and a strip of sand
  ocean: { width: CARD_WIDTH, backgroundColor: colors.sea, paddingTop: 14, alignItems: 'center', overflow: 'hidden' },
  oceanBrand: { ...bubbly, fontSize: 22, marginBottom: 10 },
  photoOcean: { borderRadius: 14, borderWidth: 4, borderColor: '#FFFFFF' },
  oceanBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.abyss,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
    marginHorizontal: 20,
  },
  oceanMessage: { fontSize: 15, fontWeight: '500', color: colors.ink, textAlign: 'center' },
  oceanMeta: { fontSize: 11, color: colors.text, marginTop: 8, marginBottom: 10 },
  oceanSand: { alignSelf: 'stretch', height: 14, backgroundColor: colors.sand },

  styleRow: { gap: 8, paddingVertical: 16 },
  styleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.deep,
  },
  styleChipActive: { backgroundColor: colors.deep },
  styleChipText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  styleChipTextActive: { color: colors.white },

  messageInput: {
    alignSelf: 'stretch',
    backgroundColor: colors.sand,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.sandBorder,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.ink,
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: colors.muted, marginTop: 4 },
  fieldLabel: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: colors.ink, marginBottom: 6, marginTop: 4 },
  textInput: { minHeight: 64, textAlignVertical: 'top' },
  linkRow: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  linkText: { fontSize: 12, color: colors.reef },
  androidNote: { alignSelf: 'stretch', fontSize: 11, color: colors.muted, marginTop: 6 },
  shareButton: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.deep,
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 14,
  },
  shareText: { color: colors.white, fontSize: 15, fontWeight: '600' },
});

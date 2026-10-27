import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

type Props = {
  title?: string;
};

// In-page back bar for pushed screens. The native stack header is hidden on
// those screens because newer iOS draws it translucent over the content; this
// sits inside the screen's top safe area instead, so nothing ends up under it.
export default function BackBar({ title }: Props) {
  const navigation = useNavigation();

  return (
    <View style={styles.bar}>
      <Pressable style={styles.back} onPress={() => navigation.goBack()} hitSlop={10}>
        <Ionicons name="chevron-back" size={22} color="#0B1418" />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 44, justifyContent: 'center', paddingHorizontal: 8 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', zIndex: 1 },
  backText: { fontSize: 16, color: '#0B1418' },
  title: {
    position: 'absolute',
    left: 90,
    right: 90,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: '#0B1418',
  },
});

import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Themed';
import { PASSWORD_RULES } from '../lib/password';
import { colors } from '../theme';

// Checklist under a new-password field; each rule turns green once met
export default function PasswordRules({ password }: { password: string }) {
  return (
    <View style={styles.rules}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.label} style={styles.ruleRow}>
            <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={met ? '#047857' : colors.faint} />
            <Text style={[styles.ruleText, met && styles.ruleTextMet]}>{rule.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { marginTop: -2, marginBottom: 12, gap: 4, paddingHorizontal: 2 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ruleText: { fontSize: 12, color: colors.muted },
  ruleTextMet: { color: '#047857' },
});

import { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Text, TextInput } from './Themed';
import DateTimeField from './DateTimeField';
import { Sheet, sheetStyles } from './GroupSheets';
import { colors } from '../theme';
import { GroupTheme, deleteGroupTheme, saveGroupTheme } from '../lib/groups';

// The owner's form for a group theme: what it is, when photos open, when
// voting opens (photos close) and when it ends

type Props = {
  visible: boolean;
  groupId: string;
  theme: GroupTheme | null; // null for a new one
  onClose: () => void;
  onSaved: () => void;
};

const DAY = 86400000;

// The next half hour, so a new theme can start right away
function nextHalfHour() {
  const d = new Date();
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
  return d;
}

type Field = 'starts' | 'voting' | 'ends';

export default function GroupThemeEditor({ visible, groupId, theme, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(nextHalfHour());
  const [votingAt, setVotingAt] = useState(new Date(nextHalfHour().getTime() + 6 * DAY));
  const [endsAt, setEndsAt] = useState(new Date(nextHalfHour().getTime() + 7 * DAY));
  const [openField, setOpenField] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setOpenField(null);
    if (theme) {
      setName(theme.name);
      setDescription(theme.description);
      setStartsAt(new Date(theme.starts_at));
      setVotingAt(new Date(theme.voting_at));
      setEndsAt(new Date(theme.ends_at));
    } else {
      // A week, with the last day for voting, like the main themes
      const start = nextHalfHour();
      setName('');
      setDescription('');
      setStartsAt(start);
      setVotingAt(new Date(start.getTime() + 6 * DAY));
      setEndsAt(new Date(start.getTime() + 7 * DAY));
    }
  }, [visible, theme]);

  // Moving the start moves the rest with it, keeping the same lengths
  const changeStart = (next: Date) => {
    const shift = next.getTime() - startsAt.getTime();
    setStartsAt(next);
    setVotingAt(new Date(votingAt.getTime() + shift));
    setEndsAt(new Date(endsAt.getTime() + shift));
  };

  const problem = !name.trim()
    ? 'Give the theme a name.'
    : votingAt <= startsAt
      ? 'Voting has to open after photos open.'
      : endsAt <= votingAt
        ? 'The theme has to end after voting opens.'
        : endsAt.getTime() <= Date.now()
          ? 'The end time has already passed.'
          : null;

  const save = async () => {
    if (problem) {
      Alert.alert('Almost there', problem);
      return;
    }
    setBusy(true);
    try {
      await saveGroupTheme(groupId, {
        id: theme?.id,
        name,
        description,
        starts_at: startsAt.toISOString(),
        voting_at: votingAt.toISOString(),
        ends_at: endsAt.toISOString(),
      });
      onSaved();
    } catch (err) {
      Alert.alert('Couldn’t save the theme', err instanceof Error ? err.message : 'Please try again.');
    }
    setBusy(false);
  };

  const remove = () =>
    theme &&
    Alert.alert(`Delete ${theme.name}?`, 'Its photos and votes will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroupTheme(theme.id);
            onSaved();
          } catch (err) {
            Alert.alert('Couldn’t delete the theme', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);

  const toggle = (field: Field) => setOpenField((current) => (current === field ? null : field));

  return (
    <Sheet visible={visible} title={theme ? 'Edit theme' : 'New theme'} onClose={onClose}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <TextInput style={sheetStyles.input} placeholder="Theme, like Shadows or Self-portrait" value={name} onChangeText={setName} maxLength={60} />
        <TextInput
          style={[sheetStyles.input, styles.description]}
          placeholder="Instructions or tips (optional)"
          value={description}
          onChangeText={setDescription}
          maxLength={300}
          multiline
        />

        <Text style={sheetStyles.sectionLabel}>Schedule</Text>
        <DateTimeField label="Photos open" value={startsAt} onChange={changeStart} open={openField === 'starts'} onToggle={() => toggle('starts')} />
        <DateTimeField
          label="Voting opens"
          value={votingAt}
          onChange={setVotingAt}
          open={openField === 'voting'}
          onToggle={() => toggle('voting')}
        />
        <DateTimeField label="Ends" value={endsAt} onChange={setEndsAt} open={openField === 'ends'} onToggle={() => toggle('ends')} />
        <Text style={sheetStyles.hint}>
          Photos can be posted until voting opens. Then everyone gets one vote until the end, and the group sees its top 3.
        </Text>

        <Pressable style={[sheetStyles.primaryButton, busy && sheetStyles.disabled]} onPress={save} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={sheetStyles.primaryText}>{theme ? 'Save changes' : 'Post theme'}</Text>}
        </Pressable>
        {theme && (
          <Pressable style={styles.deleteButton} onPress={remove}>
            <Text style={styles.deleteText}>Delete theme</Text>
          </Pressable>
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 10, paddingBottom: 20 },
  description: { minHeight: 70, textAlignVertical: 'top' },
  deleteButton: { alignItems: 'center', paddingVertical: 10 },
  deleteText: { color: '#B91C1C', fontSize: 15, fontWeight: '600' },
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ScrollViewProps,
  Image,
  Modal,
  Alert,
  RefreshControl,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Text } from './Themed';
import Stamp from './Stamp';
import FormatTag from './FormatTag';
import OchoIcon from './OchoIcon';
import { OchoPlain } from './OchoArt';
import OchoLoader from './OchoLoader';
import { ReviewCover } from './ModerationCovers';
import { InviteSheet, MembersSheet, StartOrJoinSheet, shareGroupCode } from './GroupSheets';
import GroupThemeEditor from './GroupThemeEditor';
import GroupPostSheet from './GroupPostSheet';
import { formatDateTime } from './DateTimeField';
import { colors, bubbly } from '../theme';
import { useModeration } from '../context/ModerationContext';
import {
  Group,
  GroupInvite,
  GroupPhoto,
  GroupTheme,
  castGroupVote,
  deleteGroupPhoto,
  groupPhase,
  groupThemeStatus,
  loadGroupPhotos,
  loadGroupThemes,
  loadMyGroupVote,
  loadMyGroups,
  loadMyInvites,
  orderGroupPhotos,
  pickCurrentTheme,
  respondToGroupInvite,
  topThree,
} from '../lib/groups';

// The Groups tab on Home: your groups, each with its own themes set by
// whoever started it. Post one photo per theme, vote once on voting day,
// see the group's top 3 at the end. No shutters, streaks or rankings.

type Props = {
  userId: string;
  // passed through so the Home header folds away while you scroll
  scrollProps: Partial<ScrollViewProps>;
  contentPaddingTop: number;
  contentPaddingBottom: number;
  onOpenProfile: (userId: string) => void;
};

const SELECTED_KEY = 'selectedGroup';
// Photos you've opened during a theme's voting, so you can tell what's left
const seenKey = (themeId: string) => `groupSeen:${themeId}`;
const MEDALS = { 1: '#F59E0B', 2: '#94A3B8', 3: '#B45309' } as Record<number, string>;

export default function GroupsPanel({ userId, scrollProps, contentPaddingTop, contentPaddingBottom, onOpenProfile }: Props) {
  const moderation = useModeration();
  const { width } = useWindowDimensions();
  const tile = (width - 16 * 2 - 10) / 2;

  const [groups, setGroups] = useState<Group[] | null>(null);
  const [invites, setInvites] = useState<GroupInvite[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [themes, setThemes] = useState<GroupTheme[]>([]);
  const [themeId, setThemeId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<GroupPhoto[]>([]);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  const [startOrJoinOpen, setStartOrJoinOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [editorTheme, setEditorTheme] = useState<GroupTheme | null | 'new'>(null);
  const [postOpen, setPostOpen] = useState(false);
  const [viewing, setViewing] = useState<GroupPhoto | null>(null);

  const group = groups?.find((g) => g.id === groupId) ?? null;
  const theme = themes.find((t) => t.id === themeId) ?? null;
  const isOwner = group?.owner_id === userId;
  const phase = theme ? groupPhase(theme, now) : null;
  const visiblePhotos = photos.filter((p) => !moderation.isBlocked(p.user_id));
  const mine = photos.find((p) => p.user_id === userId);
  const places = useMemo(() => (phase === 'ended' ? topThree(visiblePhotos) : new Map<string, number>()), [phase, visiblePhotos]);
  const orderedPhotos = orderGroupPhotos(visiblePhotos, phase, `${userId}:${themeId}`);
  const othersPhotos = visiblePhotos.filter((p) => p.user_id !== userId);
  const seenCount = othersPhotos.filter((p) => seen.has(p.id)).length;

  // Countdowns and phases move on their own
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadTheme = useCallback(
    async (id: string | null) => {
      setThemeId(id);
      if (!id) {
        setPhotos([]);
        setMyVote(null);
        setSeen(new Set());
        return;
      }
      const [p, v, s] = await Promise.all([
        loadGroupPhotos(id),
        loadMyGroupVote(id, userId),
        AsyncStorage.getItem(seenKey(id)).catch(() => null),
      ]);
      setPhotos(p);
      setMyVote(v);
      setSeen(new Set(s ? (JSON.parse(s) as string[]) : []));
    },
    [userId]
  );

  const loadGroup = useCallback(
    async (id: string | null, keepTheme?: string | null) => {
      setGroupId(id);
      if (!id) {
        setThemes([]);
        await loadTheme(null);
        return;
      }
      AsyncStorage.setItem(SELECTED_KEY, id).catch(() => {});
      setLoadingGroup(true);
      const list = await loadGroupThemes(id);
      setThemes(list);
      const keep = keepTheme && list.find((t) => t.id === keepTheme);
      await loadTheme((keep || pickCurrentTheme(list))?.id ?? null);
      setLoadingGroup(false);
    },
    [loadTheme]
  );

  const loadAll = useCallback(
    async (preferGroup?: string | null) => {
      const [mineList, inviteList, saved] = await Promise.all([
        loadMyGroups(userId),
        loadMyInvites(userId),
        AsyncStorage.getItem(SELECTED_KEY).catch(() => null),
      ]);
      setGroups(mineList);
      setInvites(inviteList);
      const wanted = [preferGroup, saved].find((id) => id && mineList.some((g) => g.id === id));
      await loadGroup(wanted ?? mineList[0]?.id ?? null, preferGroup ? null : themeId);
    },
    [userId, loadGroup] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    loadAll();
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = async () => {
    setRefreshing(true);
    await loadAll(groupId);
    setRefreshing(false);
  };

  const answerInvite = async (invite: GroupInvite, accept: boolean) => {
    try {
      await respondToGroupInvite(invite.groupId, accept);
      await loadAll(accept ? invite.groupId : groupId);
    } catch (err) {
      Alert.alert('Couldn’t do that', err instanceof Error ? err.message : 'Please try again.');
      loadAll(groupId);
    }
  };

  const openPhoto = (photo: GroupPhoto) => {
    setViewing(photo);
    if (phase !== 'vote' || !theme || seen.has(photo.id)) return;
    const next = new Set(seen).add(photo.id);
    setSeen(next);
    AsyncStorage.setItem(seenKey(theme.id), JSON.stringify([...next])).catch(() => {});
  };

  const vote = async (photo: GroupPhoto) => {
    if (!theme) return;
    try {
      const next = await castGroupVote(theme.id, userId, photo.id, myVote);
      setMyVote(next);
    } catch {
      Alert.alert('Couldn’t vote', 'Voting may have closed. Pull down to refresh.');
    }
  };

  const removePhoto = (photo: GroupPhoto) =>
    Alert.alert(photo.user_id === userId ? 'Delete your photo?' : `Remove ${photo.username}’s photo?`, 'Its votes go with it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: photo.user_id === userId ? 'Delete' : 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteGroupPhoto(photo.id);
            setViewing(null);
            loadTheme(theme?.id ?? null);
          } catch (err) {
            Alert.alert('Couldn’t remove it', err instanceof Error ? err.message : 'Please try again.');
          }
        },
      },
    ]);

  if (groups === null) {
    return (
      <View style={[styles.loading, { paddingTop: contentPaddingTop + 40 }]}>
        <OchoLoader message="Ocho is gathering your groups…" />
      </View>
    );
  }

  const inviteCards = invites.map((invite) => (
    <View key={invite.groupId} style={styles.inviteCard}>
      <Ionicons name="people-circle" size={30} color={colors.deep} />
      <Text style={styles.inviteText}>
        <Text style={styles.bold}>{invite.inviter.username}</Text> invited you to <Text style={styles.bold}>{invite.groupName}</Text>
      </Text>
      <View style={styles.inviteButtons}>
        <Pressable style={styles.joinButton} onPress={() => answerInvite(invite, true)}>
          <Text style={styles.joinText}>Join</Text>
        </Pressable>
        <Pressable style={styles.declineButton} onPress={() => answerInvite(invite, false)}>
          <Text style={styles.declineText}>Decline</Text>
        </Pressable>
      </View>
    </View>
  ));

  const sheets = (
    <>
      <StartOrJoinSheet
        visible={startOrJoinOpen}
        onClose={() => setStartOrJoinOpen(false)}
        onDone={(id) => {
          setStartOrJoinOpen(false);
          loadAll(id);
        }}
      />
      {group && (
        <>
          <InviteSheet visible={inviteOpen} group={group} myId={userId} onClose={() => setInviteOpen(false)} />
          <MembersSheet
            visible={membersOpen}
            group={group}
            myId={userId}
            onClose={() => {
              setMembersOpen(false);
              loadAll(groupId);
            }}
            onOpenProfile={(id) => {
              setMembersOpen(false);
              onOpenProfile(id);
            }}
            onLeft={() => {
              setMembersOpen(false);
              AsyncStorage.removeItem(SELECTED_KEY).catch(() => {});
              loadAll(null);
            }}
          />
          <GroupThemeEditor
            visible={editorTheme !== null}
            groupId={group.id}
            theme={editorTheme === 'new' ? null : editorTheme}
            onClose={() => setEditorTheme(null)}
            onSaved={() => {
              setEditorTheme(null);
              loadGroup(group.id, editorTheme === 'new' ? null : themeId);
            }}
          />
        </>
      )}
      {theme && (
        <GroupPostSheet
          visible={postOpen}
          theme={theme}
          userId={userId}
          onClose={() => setPostOpen(false)}
          onPosted={() => {
            setPostOpen(false);
            loadTheme(theme.id);
          }}
        />
      )}
    </>
  );

  // ------------------------------------------------------------- no groups
  if (groups.length === 0) {
    return (
      <ScrollView
        {...scrollProps}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        {inviteCards}
        <View style={styles.empty}>
          <OchoPlain size={90} />
          <Text style={styles.emptyTitle}>Photo groups</Text>
          <Text style={styles.emptyText}>
            Start a group for your class or friends and set your own themes, with your own deadlines and voting day. Group photos
            are just for the group, and don’t earn shutters or count toward rankings.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => setStartOrJoinOpen(true)}>
            <Text style={styles.primaryText}>Start or join a group</Text>
          </Pressable>
        </View>
        {sheets}
      </ScrollView>
    );
  }

  // ------------------------------------------------------------ your groups
  return (
    <ScrollView
      {...scrollProps}
      style={styles.flex}
      contentContainerStyle={[styles.content, { paddingTop: contentPaddingTop, paddingBottom: contentPaddingBottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      {inviteCards}

      {/* group picker */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {groups.map((g) => (
          <Pressable key={g.id} style={[styles.chip, g.id === groupId && styles.chipActive]} onPress={() => loadGroup(g.id)}>
            <Text style={[styles.chipText, g.id === groupId && styles.chipTextActive]} numberOfLines={1}>
              {g.name}
            </Text>
          </Pressable>
        ))}
        <Pressable style={[styles.chip, styles.addChip]} onPress={() => setStartOrJoinOpen(true)} accessibilityLabel="Start or join a group">
          <Ionicons name="add" size={18} color={colors.deep} />
        </Pressable>
      </ScrollView>

      {group && (
        <View style={styles.groupCard}>
          <Text style={styles.groupName}>{group.name}</Text>
          <Text style={styles.groupMeta}>
            {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}
            {isOwner ? ' · You run this group' : ''}
          </Text>
          <View style={styles.groupButtons}>
            <Pressable style={styles.pillButton} onPress={() => shareGroupCode(group)}>
              <Ionicons name="share-outline" size={14} color={colors.deep} />
              <Stamp style={styles.codeStamp}>{group.invite_code}</Stamp>
            </Pressable>
            <Pressable style={styles.pillButton} onPress={() => setInviteOpen(true)}>
              <Ionicons name="person-add-outline" size={14} color={colors.deep} />
              <Text style={styles.pillText}>Invite</Text>
            </Pressable>
            <Pressable style={styles.pillButton} onPress={() => setMembersOpen(true)}>
              <Ionicons name="people-outline" size={14} color={colors.deep} />
              <Text style={styles.pillText}>Members</Text>
            </Pressable>
          </View>
        </View>
      )}

      {loadingGroup ? (
        <ActivityIndicator color={colors.deep} style={{ marginTop: 30 }} />
      ) : themes.length === 0 ? (
        <View style={styles.noTheme}>
          <Text style={styles.emptyText}>
            {isOwner ? 'Set the group’s first theme: what to shoot, and when photos and voting close.' : 'No theme yet. The group’s owner will post one soon.'}
          </Text>
          {isOwner && (
            <Pressable style={styles.primaryButton} onPress={() => setEditorTheme('new')}>
              <Text style={styles.primaryText}>Set a theme</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <>
          {/* theme picker, newest first */}
          {(themes.length > 1 || isOwner) && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {themes.map((t) => (
                <Pressable key={t.id} style={[styles.themeChip, t.id === themeId && styles.chipActive]} onPress={() => loadTheme(t.id)}>
                  <Text style={[styles.chipText, t.id === themeId && styles.chipTextActive]} numberOfLines={1}>
                    {t.name}
                  </Text>
                  <Text style={[styles.themeChipPhase, t.id === themeId && styles.chipTextActive]}>
                    {{ upcoming: 'Soon', submit: 'Open', vote: 'Voting', ended: 'Ended' }[groupPhase(t, now)]}
                  </Text>
                </Pressable>
              ))}
              {isOwner && (
                <Pressable style={[styles.themeChip, styles.addChip]} onPress={() => setEditorTheme('new')}>
                  <Ionicons name="add" size={16} color={colors.deep} />
                  <Text style={styles.chipText}>New theme</Text>
                </Pressable>
              )}
            </ScrollView>
          )}

          {theme && (
            <View style={styles.themeCard}>
              <View style={styles.themeTop}>
                <Text style={styles.themeLabel}>GROUP THEME</Text>
                {isOwner && (
                  <Pressable hitSlop={8} onPress={() => setEditorTheme(theme)}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.themeName}>{theme.name}</Text>
              {theme.description ? <Text style={styles.themeDescription}>{theme.description}</Text> : null}
              <Stamp style={styles.themeStatus}>{groupThemeStatus(theme, now).toUpperCase()}</Stamp>
              <View style={styles.schedule}>
                <Text style={styles.scheduleLine}>Photos open {formatDateTime(new Date(theme.starts_at))}</Text>
                <Text style={styles.scheduleLine}>Voting opens {formatDateTime(new Date(theme.voting_at))}</Text>
                <Text style={styles.scheduleLine}>Ends {formatDateTime(new Date(theme.ends_at))}</Text>
              </View>

              {phase === 'submit' &&
                (mine ? (
                  <View style={styles.inPill}>
                    <Ionicons name="checkmark-circle" size={14} color="#166534" />
                    <Text style={styles.inPillText}>Your photo is in</Text>
                  </View>
                ) : (
                  <Pressable style={styles.primaryButton} onPress={() => setPostOpen(true)}>
                    <Text style={styles.primaryText}>Post your photo</Text>
                  </Pressable>
                ))}
              {phase === 'vote' && (
                <Text style={styles.phaseHint}>
                  {myVote ? 'You’ve voted. Tap your pick again to take it back, or tap another photo to move your vote.' : 'Voting is open: tap a photo to vote. You get one vote, not for your own photo.'}
                  {othersPhotos.length > 0 &&
                    (seenCount < othersPhotos.length
                      ? ` You’ve looked at ${seenCount} of ${othersPhotos.length}. The photos are in a different order for everyone.`
                      : ' You’ve looked at every photo.')}
                </Text>
              )}
              {phase === 'ended' && places.size > 0 && <Text style={styles.phaseHint}>Here’s the group’s top 3.</Text>}
            </View>
          )}

          {theme && phase !== 'upcoming' && (
            visiblePhotos.length === 0 ? (
              <Text style={[styles.emptyText, styles.noPhotos]}>
                {phase === 'submit' ? 'No photos yet. Be the first!' : 'No photos were posted for this theme.'}
              </Text>
            ) : (
              <View style={styles.grid}>
                {orderedPhotos.map((p) => {
                  const cover = moderation.coverFor(p.id, p.user_id);
                  const place = places.get(p.id);
                  // dimmed once you've opened it, so the bright ones are what's left to see
                  const looked = phase === 'vote' && p.user_id !== userId && seen.has(p.id) && myVote !== p.id;
                  return (
                    <Pressable key={p.id} style={{ width: tile }} onPress={() => !cover && openPhoto(p)}>
                      <View style={[styles.tile, { width: tile, height: tile }]}>
                        <Image source={{ uri: p.image_url }} style={[StyleSheet.absoluteFill, looked && styles.looked]} />
                        {looked && (
                          <View style={styles.lookedBadge}>
                            <Ionicons name="eye" size={12} color={colors.white} />
                          </View>
                        )}
                        {cover && <ReviewCover kind={cover} compact />}
                        {myVote === p.id && (
                          <View style={styles.votedBadge}>
                            <OchoIcon name="vote" size={14} color={colors.white} filled />
                          </View>
                        )}
                        {place && (
                          <View style={[styles.placeBadge, { backgroundColor: MEDALS[place] }]}>
                            <Text style={styles.placeText}>{place}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.tileName} numberOfLines={1}>
                        {p.username}
                        {phase === 'ended' ? ` · ${p.vote_count} ${p.vote_count === 1 ? 'vote' : 'votes'}` : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )
          )}
        </>
      )}

      <Text style={styles.footnote}>Group themes don’t earn shutters or count toward streaks and rankings.</Text>

      {sheets}

      {/* one photo, full size, with its vote button */}
      <Modal visible={!!viewing} transparent animationType="fade" onRequestClose={() => setViewing(null)}>
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewing(null)}>
          {viewing && (
            <Pressable style={styles.viewerCard} onPress={() => {}}>
              <View style={styles.viewerHeader}>
                <Pressable
                  style={styles.viewerUser}
                  onPress={() => {
                    setViewing(null);
                    onOpenProfile(viewing.user_id);
                  }}
                >
                  {viewing.avatar_url ? <Image source={{ uri: viewing.avatar_url }} style={styles.viewerAvatar} /> : <View style={styles.viewerAvatar} />}
                  <Text style={styles.viewerName}>{viewing.username}</Text>
                  <FormatTag format={viewing.format} />
                </Pressable>
                {viewing.user_id === userId || isOwner ? (
                  <Pressable hitSlop={10} onPress={() => removePhoto(viewing)}>
                    <Ionicons name="trash-outline" size={20} color={colors.muted} />
                  </Pressable>
                ) : null}
                {viewing.user_id !== userId && (
                  <Pressable
                    hitSlop={10}
                    style={{ marginLeft: 12 }}
                    onPress={() =>
                      moderation.openContentMenu(
                        { kind: 'group_photo', id: viewing.id, userId: viewing.user_id, username: viewing.username },
                        () => setViewing(null)
                      )
                    }
                  >
                    <OchoIcon name="more" size={20} color={colors.muted} />
                  </Pressable>
                )}
              </View>
              <Image source={{ uri: viewing.image_url }} style={styles.viewerImage} resizeMode="contain" />
              {viewing.caption ? <Text style={styles.viewerCaption}>{viewing.caption}</Text> : null}
              {phase === 'vote' && viewing.user_id !== userId && (
                <Pressable style={[styles.voteButton, myVote === viewing.id && styles.voteButtonActive]} onPress={() => vote(viewing)}>
                  <OchoIcon name="vote" size={17} color={myVote === viewing.id ? colors.white : colors.coral} filled={myVote === viewing.id} />
                  <Text style={[styles.voteText, myVote === viewing.id && styles.voteTextActive]}>
                    {myVote === viewing.id ? 'Your vote' : myVote ? 'Move your vote here' : 'Vote for this photo'}
                  </Text>
                </Pressable>
              )}
              {phase === 'ended' && (
                <Stamp style={styles.viewerVotes}>
                  {viewing.vote_count} {viewing.vote_count === 1 ? 'VOTE' : 'VOTES'}
                </Stamp>
              )}
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { alignItems: 'center' },
  content: { paddingHorizontal: 16, gap: 12 },
  bold: { fontWeight: '600', color: colors.ink },

  inviteCard: {
    backgroundColor: colors.reefLight,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  inviteText: { flex: 1, minWidth: 160, fontSize: 14, color: colors.text },
  inviteButtons: { flexDirection: 'row', gap: 8 },
  joinButton: { backgroundColor: colors.deep, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
  joinText: { color: colors.white, fontSize: 13, fontWeight: '600' },
  declineButton: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  declineText: { color: colors.muted, fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', gap: 10, paddingTop: 30, paddingHorizontal: 10 },
  emptyTitle: { ...bubbly, fontSize: 24 },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  primaryButton: {
    backgroundColor: colors.coral,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 4,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: '600' },

  chips: { gap: 8, paddingRight: 8 },
  chip: {
    backgroundColor: colors.sand,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: 180,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.deep },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.deep },
  chipTextActive: { color: colors.white },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.shell, borderWidth: 1.5, borderColor: colors.sandBorder },
  themeChip: {
    backgroundColor: colors.sand,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 170,
    justifyContent: 'center',
  },
  themeChipPhase: { fontSize: 11, color: colors.muted },

  groupCard: { backgroundColor: colors.sandLight, borderRadius: 16, padding: 14, gap: 4 },
  groupName: { ...bubbly, fontSize: 22 },
  groupMeta: { fontSize: 13, color: colors.muted },
  groupButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.shell,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: { fontSize: 13, fontWeight: '600', color: colors.deep },
  codeStamp: { fontSize: 14, letterSpacing: 2 },

  noTheme: { alignItems: 'center', gap: 10, paddingTop: 16 },

  themeCard: { backgroundColor: colors.sandLight, borderRadius: 16, padding: 14, gap: 6 },
  themeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  themeLabel: { fontSize: 11, letterSpacing: 1.2, color: colors.muted, fontWeight: '600' },
  editText: { fontSize: 13, fontWeight: '600', color: colors.reef },
  themeName: { ...bubbly, fontSize: 26 },
  themeDescription: { fontSize: 14, color: colors.text, lineHeight: 20 },
  themeStatus: { marginTop: 2 },
  schedule: { gap: 2, marginTop: 2 },
  scheduleLine: { fontSize: 12, color: colors.muted },
  inPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  inPillText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  phaseHint: { fontSize: 13, color: colors.text, marginTop: 4, lineHeight: 18 },

  noPhotos: { marginTop: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.sand },
  tileName: { fontSize: 12, color: colors.text, marginTop: 4 },
  votedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: colors.coral,
    borderRadius: 12,
    padding: 5,
  },
  placeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  looked: { opacity: 0.55 },
  lookedBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    borderRadius: 10,
    padding: 4,
  },
  placeText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  footnote: { fontSize: 12, color: colors.faint, textAlign: 'center', marginTop: 10 },

  viewerBackdrop: { flex: 1, backgroundColor: colors.backdrop, justifyContent: 'center', padding: 16 },
  viewerCard: { backgroundColor: colors.shell, borderRadius: 18, padding: 14, gap: 10 },
  viewerHeader: { flexDirection: 'row', alignItems: 'center' },
  viewerUser: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  viewerAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.sand },
  viewerName: { fontSize: 15, fontWeight: '600', color: colors.ink },
  viewerImage: { width: '100%', aspectRatio: 1, borderRadius: 10, backgroundColor: colors.sand },
  viewerCaption: { fontSize: 14, color: colors.text },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.coral,
    borderRadius: 12,
    paddingVertical: 10,
  },
  voteButtonActive: { backgroundColor: colors.coral },
  voteText: { fontSize: 15, fontWeight: '600', color: colors.coral },
  voteTextActive: { color: colors.white },
  viewerVotes: { textAlign: 'center' },
});

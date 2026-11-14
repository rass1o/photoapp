import { supabase } from './supabase';
import { formatTimeLeft } from './themes';

// Groups: private spaces with their own themes, set by whoever started the
// group. Nothing here pays shutters or touches streaks and rankings (see
// supabase/migrations/20261126_groups.sql).

export type Group = {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  memberCount: number;
};

export type GroupInvite = {
  groupId: string;
  groupName: string;
  inviter: { id: string; username: string };
};

export type GroupMember = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type GroupTheme = {
  id: string;
  group_id: string;
  name: string;
  description: string;
  starts_at: string;
  voting_at: string;
  ends_at: string;
};

export type GroupPhoto = {
  id: string;
  group_theme_id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  caption: string;
  film_strip: boolean;
  vote_count: number;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

export type GroupPhase = 'upcoming' | 'submit' | 'vote' | 'ended';

export function groupPhase(theme: GroupTheme, now = Date.now()): GroupPhase {
  if (now < new Date(theme.starts_at).getTime()) return 'upcoming';
  if (now < new Date(theme.voting_at).getTime()) return 'submit';
  if (now < new Date(theme.ends_at).getTime()) return 'vote';
  return 'ended';
}

// "Photos close in 2d 5h", like the weekly theme's countdown
export function groupThemeStatus(theme: GroupTheme, now = Date.now()) {
  const left = (iso: string) => formatTimeLeft(new Date(iso).getTime() - now);
  switch (groupPhase(theme, now)) {
    case 'upcoming':
      return `Starts in ${left(theme.starts_at)}`;
    case 'submit':
      return `Photos close in ${left(theme.voting_at)}`;
    case 'vote':
      return `Voting ends in ${left(theme.ends_at)}`;
    default:
      return 'Ended';
  }
}

// The theme to open first: the one running now, else the next one coming
// up, else the one that ended last
export function pickCurrentTheme(themes: GroupTheme[], now = Date.now()) {
  const running = themes.find((t) => groupPhase(t, now) === 'submit' || groupPhase(t, now) === 'vote');
  if (running) return running;
  const upcoming = themes
    .filter((t) => groupPhase(t, now) === 'upcoming')
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0];
  return upcoming ?? themes[0] ?? null;
}

// Places with ties shared, like the weekly results: 3, 3, 1 votes -> 1, 1, 3
export function topThree(photos: GroupPhoto[]) {
  const ranked = [...photos].filter((p) => p.vote_count > 0).sort((a, b) => b.vote_count - a.vote_count);
  const places = new Map<string, number>();
  let place = 0;
  ranked.forEach((p, i) => {
    if (i === 0 || p.vote_count !== ranked[i - 1].vote_count) place = i + 1;
    if (place <= 3) places.set(p.id, place);
  });
  return places;
}

// A number from a string (FNV-1a), the same every time for the same string
function hashKey(text: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// The order photos show in. While photos are coming in, newest first. During
// voting, a shuffle that's different for each person but stays put for the
// whole theme, so no photo ends up at the top (or the bottom) for when it
// was posted. Once it ends, most votes first.
export function orderGroupPhotos(photos: GroupPhoto[], phase: GroupPhase | null, seed: string) {
  if (phase !== 'vote' && phase !== 'ended') return photos;
  const keyed = photos.map((p) => ({ p, key: hashKey(`${seed}:${p.id}`) }));
  keyed.sort((a, b) => (phase === 'ended' ? b.p.vote_count - a.p.vote_count : 0) || a.key - b.key);
  return keyed.map(({ p }) => p);
}

export async function loadMyGroups(myId: string): Promise<Group[]> {
  const { data: memberships } = await supabase.from('group_members').select('group_id').eq('user_id', myId);
  const ids = (memberships ?? []).map((m) => m.group_id);
  if (ids.length === 0) return [];

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from('groups').select('id, name, owner_id, invite_code, created_at').in('id', ids).order('created_at'),
    supabase.from('group_members').select('group_id').in('group_id', ids),
  ]);
  const counts = new Map<string, number>();
  (members ?? []).forEach((m) => counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1));
  return (groups ?? []).map((g) => ({ ...g, memberCount: counts.get(g.id) ?? 1 }));
}

export async function loadMyInvites(myId: string): Promise<GroupInvite[]> {
  const { data: invites } = await supabase
    .from('group_invites')
    .select('group_id, inviter_id')
    .eq('invitee_id', myId)
    .order('created_at', { ascending: false });
  const rows = invites ?? [];
  if (rows.length === 0) return [];

  const [{ data: groups }, { data: inviters }] = await Promise.all([
    supabase.from('groups').select('id, name').in('id', rows.map((r) => r.group_id)),
    supabase.from('profiles').select('id, username').in('id', rows.map((r) => r.inviter_id)),
  ]);
  const nameById = new Map((groups ?? []).map((g) => [g.id, g.name]));
  const inviterById = new Map((inviters ?? []).map((p) => [p.id, p]));
  return rows
    .filter((r) => nameById.has(r.group_id))
    .map((r) => ({
      groupId: r.group_id,
      groupName: nameById.get(r.group_id)!,
      inviter: inviterById.get(r.inviter_id) ?? { id: r.inviter_id, username: 'someone' },
    }));
}

export async function loadMembers(groupId: string): Promise<GroupMember[]> {
  const { data } = await supabase.from('group_members').select('user_id, joined_at').eq('group_id', groupId).order('joined_at');
  const ids = (data ?? []).map((m) => m.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as GroupMember]));
  return ids.map((id) => byId.get(id)).filter((m): m is GroupMember => !!m);
}

// Friends you've already invited to this group, so their button can say so
export async function loadPendingInviteeIds(groupId: string) {
  const { data } = await supabase.from('group_invites').select('invitee_id').eq('group_id', groupId);
  return new Set((data ?? []).map((r) => r.invitee_id as string));
}

export async function loadGroupThemes(groupId: string): Promise<GroupTheme[]> {
  const { data } = await supabase
    .from('group_themes')
    .select('id, group_id, name, description, starts_at, voting_at, ends_at')
    .eq('group_id', groupId)
    .order('starts_at', { ascending: false });
  return (data ?? []) as GroupTheme[];
}

export async function loadGroupPhotos(themeId: string): Promise<GroupPhoto[]> {
  const { data } = await supabase
    .from('group_submissions')
    .select('id, group_theme_id, user_id, image_url, format, caption, film_strip, vote_count, created_at')
    .eq('group_theme_id', themeId)
    .order('created_at', { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', [...new Set(rows.map((r) => r.user_id))]);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...(r as Omit<GroupPhoto, 'username' | 'avatar_url'>),
    username: byId.get(r.user_id)?.username ?? 'unknown',
    avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
  }));
}

// Which photo you voted for in a theme, if any
export async function loadMyGroupVote(themeId: string, myId: string) {
  const { data } = await supabase
    .from('group_votes')
    .select('submission_id')
    .eq('group_theme_id', themeId)
    .eq('voter_id', myId)
    .maybeSingle();
  return (data?.submission_id as string | undefined) ?? null;
}

// Moves your one vote to this photo (or takes it back if it's already there)
export async function castGroupVote(themeId: string, myId: string, photoId: string, current: string | null) {
  if (current) {
    const { error } = await supabase.from('group_votes').delete().eq('group_theme_id', themeId).eq('voter_id', myId);
    if (error) throw error;
    if (current === photoId) return null;
  }
  const { error } = await supabase.from('group_votes').insert({ group_theme_id: themeId, voter_id: myId, submission_id: photoId });
  if (error) throw error;
  return photoId;
}

// The server functions raise readable messages; pass them through
async function call<T>(fn: string, args: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export const createGroup = (name: string) =>
  call<{ id: string; name: string; invite_code: string }>('create_group', { p_name: name });
export const joinGroup = (code: string) => call<{ id: string; name: string }>('join_group', { p_code: code });
export const inviteToGroup = (groupId: string, userId: string) => call<void>('invite_to_group', { p_group: groupId, p_user: userId });
export const respondToGroupInvite = (groupId: string, accept: boolean) =>
  call<void>('respond_group_invite', { p_group: groupId, p_accept: accept });
export const leaveGroup = (groupId: string) => call<void>('leave_group', { p_group: groupId });
export const removeGroupMember = (groupId: string, userId: string) =>
  call<void>('remove_group_member', { p_group: groupId, p_user: userId });
export const deleteGroup = (groupId: string) => call<void>('delete_group', { p_group: groupId });

export async function saveGroupTheme(
  groupId: string,
  theme: { id?: string; name: string; description: string; starts_at: string; voting_at: string; ends_at: string }
) {
  const row = {
    name: theme.name.trim(),
    description: theme.description.trim(),
    starts_at: theme.starts_at,
    voting_at: theme.voting_at,
    ends_at: theme.ends_at,
  };
  const { error } = theme.id
    ? await supabase.from('group_themes').update(row).eq('id', theme.id)
    : await supabase.from('group_themes').insert({ ...row, group_id: groupId });
  if (error) throw new Error(error.message);
}

export async function deleteGroupTheme(themeId: string) {
  const { error } = await supabase.from('group_themes').delete().eq('id', themeId);
  if (error) throw new Error(error.message);
}

export async function deleteGroupPhoto(photoId: string) {
  const { error } = await supabase.from('group_submissions').delete().eq('id', photoId);
  if (error) throw new Error(error.message);
}

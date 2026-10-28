import { supabase } from './supabase';

export type FriendStatus = 'none' | 'outgoing' | 'incoming' | 'friends';

export type FriendProfile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export type FriendRequest = {
  id: string; // friendships row id
  createdAt: string;
  from: FriendProfile;
};

type FriendshipRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
};

// Screens showing friend data subscribe here, so accepting a request from
// the popup (or one arriving live) updates the Profile without a reload.
const listeners = new Set<() => void>();

export function onFriendsChanged(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyFriendsChanged() {
  listeners.forEach((listener) => listener());
}

async function profilesById(ids: string[]) {
  if (ids.length === 0) return new Map<string, FriendProfile>();
  const { data } = await supabase.from('profiles').select('id, username, avatar_url').in('id', ids);
  return new Map((data ?? []).map((p) => [p.id as string, p as FriendProfile]));
}

// Where you stand with another user, and the request id if one is pending
export async function getFriendship(myId: string, otherId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, addressee_id, status, created_at')
    .or(
      `and(requester_id.eq.${myId},addressee_id.eq.${otherId}),and(requester_id.eq.${otherId},addressee_id.eq.${myId})`
    )
    .maybeSingle();

  const row = data as FriendshipRow | null;
  let status: FriendStatus = 'none';
  if (row?.status === 'accepted') status = 'friends';
  else if (row) status = row.requester_id === myId ? 'outgoing' : 'incoming';
  return { status, requestId: row?.id ?? null };
}

export async function loadFriendIds(myId: string) {
  const { data } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${myId},addressee_id.eq.${myId}`);
  return (data ?? []).map((r) => (r.requester_id === myId ? r.addressee_id : r.requester_id) as string);
}

export async function loadFriends(myId: string) {
  const ids = await loadFriendIds(myId);
  const byId = await profilesById(ids);
  return [...byId.values()].sort((a, b) => a.username.localeCompare(b.username));
}

export async function loadIncomingRequests(myId: string): Promise<FriendRequest[]> {
  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at')
    .eq('addressee_id', myId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const rows = data ?? [];
  const byId = await profilesById(rows.map((r) => r.requester_id));
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    from: byId.get(r.requester_id) ?? { id: r.requester_id, username: 'someone', avatar_url: null },
  }));
}

export async function loadFriendRequest(requestId: string): Promise<FriendRequest | null> {
  const { data } = await supabase
    .from('friendships')
    .select('id, requester_id, created_at, status')
    .eq('id', requestId)
    .maybeSingle();
  if (!data || data.status !== 'pending') return null;

  const byId = await profilesById([data.requester_id]);
  return {
    id: data.id,
    createdAt: data.created_at,
    from: byId.get(data.requester_id) ?? { id: data.requester_id, username: 'someone', avatar_url: null },
  };
}

export async function friendCount(userId: string) {
  const { data } = await supabase.rpc('friend_count', { p_user: userId });
  return (data as number | null) ?? 0;
}

// Returns 'pending', or 'accepted' if they had already sent you one
export async function sendFriendRequest(userId: string) {
  const { data, error } = await supabase.rpc('send_friend_request', { p_user: userId });
  if (error) throw error;
  notifyFriendsChanged();
  return data as 'pending' | 'accepted';
}

export async function respondToRequest(requestId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_friend_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error) throw error;
  notifyFriendsChanged();
}

// Unfriend, or cancel a request you sent
export async function removeFriendship(userId: string) {
  const { error } = await supabase.rpc('remove_friendship', { p_user: userId });
  if (error) throw error;
  notifyFriendsChanged();
}

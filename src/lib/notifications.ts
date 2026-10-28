import { supabase } from './supabase';

export type NotificationType = 'vote' | 'comment' | 'friend_request' | 'friend_accepted';

export type AppNotification = {
  id: string;
  type: NotificationType;
  createdAt: string;
  read: boolean;
  actor: { id: string; username: string; avatar_url: string | null };
  submissionId: string | null;
  imageUrl: string | null;
  friendshipId: string | null;
  body: string | null;
};

const PAGE = 50;

export async function loadNotifications(): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('id, type, actor_id, submission_id, friendship_id, body, created_at, read_at')
    .order('created_at', { ascending: false })
    .limit(PAGE);

  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const submissionIds = [...new Set(rows.map((r) => r.submission_id).filter((id): id is string => !!id))];

  const [{ data: profiles }, { data: submissions }] = await Promise.all([
    actorIds.length
      ? supabase.from('profiles').select('id, username, avatar_url').in('id', actorIds)
      : Promise.resolve({ data: [] as Array<{ id: string; username: string; avatar_url: string | null }> }),
    submissionIds.length
      ? supabase.from('submissions').select('id, image_url').in('id', submissionIds)
      : Promise.resolve({ data: [] as Array<{ id: string; image_url: string }> }),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
  const imageById = new Map((submissions ?? []).map((s) => [s.id, s.image_url]));

  return rows.map((r) => ({
    id: r.id,
    type: r.type as NotificationType,
    createdAt: r.created_at,
    read: !!r.read_at,
    actor: profileById.get(r.actor_id) ?? { id: r.actor_id, username: 'someone', avatar_url: null },
    submissionId: r.submission_id,
    imageUrl: r.submission_id ? imageById.get(r.submission_id) ?? null : null,
    friendshipId: r.friendship_id,
    body: r.body,
  }));
}

export async function countUnread() {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .is('read_at', null);
  return count ?? 0;
}

export async function markAllRead() {
  await supabase.rpc('mark_notifications_read');
}

// "3m", "5h", "2d", then a date
export function timeAgo(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

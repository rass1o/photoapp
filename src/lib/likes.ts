import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';

// Likes: a heart any time during a theme, separate from voting. They rank
// photos until voting day, and your liked photos are saved on your profile
// so you can find them again to vote. A theme's likes clear when it ends.

export function useLikes(
  userId: string | null | undefined,
  // Lets the screen adjust shown like counts
  onCountChange?: (submissionId: string, delta: number) => void
) {
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    if (!userId) return setLiked(new Set());
    const { data } = await supabase.from('likes').select('submission_id').eq('user_id', userId);
    setLiked(new Set((data ?? []).map((l) => l.submission_id as string)));
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggle = async (submissionId: string) => {
    if (!userId) return;
    const wasLiked = liked.has(submissionId);
    const flip = (on: boolean) =>
      setLiked((prev) => {
        const next = new Set(prev);
        if (on) next.add(submissionId);
        else next.delete(submissionId);
        return next;
      });

    flip(!wasLiked);
    onCountChange?.(submissionId, wasLiked ? -1 : 1);
    const { error } = wasLiked
      ? await supabase.from('likes').delete().eq('user_id', userId).eq('submission_id', submissionId)
      : await supabase.from('likes').insert({ user_id: userId, submission_id: submissionId });
    if (error) {
      flip(wasLiked);
      onCountChange?.(submissionId, wasLiked ? 1 : -1);
      Alert.alert('Couldn’t like that', error.message);
    }
  };

  // Like only (double-tap never un-likes)
  const like = (submissionId: string) => {
    if (!liked.has(submissionId)) toggle(submissionId);
  };

  return { liked, toggle, like, reload };
}

import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from './supabase';

// Weekly voting: on a theme's last day everyone gets one overall vote plus
// one vote in each category. Voting for a new photo in a category you've
// already used moves the vote there (cast_vote on the server).

export type VoteCategory = { id: string; label: string; icon: string };

export const OVERALL: VoteCategory = { id: 'overall', label: 'Overall favorite', icon: 'star' };

let categoriesCache: VoteCategory[] | null = null;

export async function loadVoteCategories() {
  if (categoriesCache) return categoriesCache;
  const { data } = await supabase.from('vote_categories').select('id, label, icon').order('sort_order');
  categoriesCache = (data ?? []) as VoteCategory[];
  return categoriesCache;
}

// Your votes this theme: category id ('overall' included) -> submission id
export type MyVotes = Record<string, string>;

export function useThemeVotes(
  themeId: string | null | undefined,
  userId: string | null | undefined,
  // Lets the screen adjust shown overall vote counts when one moves
  onOverallMoved?: (from: string | null, to: string | null) => void
) {
  const [categories, setCategories] = useState<VoteCategory[]>([]);
  const [mine, setMine] = useState<MyVotes>({});

  const reload = useCallback(async () => {
    if (!themeId || !userId) {
      setMine({});
      return;
    }
    const [cats, overall, byCategory] = await Promise.all([
      loadVoteCategories(),
      supabase
        .from('votes')
        .select('submission_id, submissions!inner(theme_id)')
        .eq('user_id', userId)
        .eq('submissions.theme_id', themeId),
      supabase.from('category_votes').select('category, submission_id').eq('user_id', userId).eq('theme_id', themeId),
    ]);
    setCategories(cats);
    const next: MyVotes = {};
    (overall.data ?? []).forEach((v) => (next.overall = v.submission_id as string));
    (byCategory.data ?? []).forEach((v) => (next[v.category as string] = v.submission_id as string));
    setMine(next);
  }, [themeId, userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  // Vote for (or take back the vote from) a photo in one category
  const toggle = async (submissionId: string, category: string) => {
    const before = mine;
    const removing = mine[category] === submissionId;
    const next = { ...mine };
    if (removing) delete next[category];
    else next[category] = submissionId;
    setMine(next);
    if (category === 'overall') onOverallMoved?.(before.overall ?? null, removing ? null : submissionId);

    const { error } = removing
      ? await supabase.rpc('remove_vote', { p_submission: submissionId, p_category: category })
      : await supabase.rpc('cast_vote', { p_submission: submissionId, p_category: category });
    if (error) {
      setMine(before);
      if (category === 'overall') onOverallMoved?.(removing ? null : submissionId, before.overall ?? null);
      Alert.alert('Couldn’t vote', error.message);
    }
  };

  return { categories, mine, toggle, reload };
}

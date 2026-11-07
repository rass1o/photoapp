import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Animated,
  Easing,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { ensureCurrentTheme, formatTimeLeft, themePhase, themeStatus, votingOpensAt } from '../lib/themes';
import { loadVoteCategories, useThemeVotes } from '../lib/voting';
import { useLikes } from '../lib/likes';
import VoteSheet from '../components/VoteSheet';
import { localDateString } from '../lib/date';
import { useAuth } from '../context/AuthContext';
import type { RootStackParamList } from '../navigation/AppNavigator';
import WeeklyWinnersModal, { Winner } from '../components/WeeklyWinnersModal';
import ThemeWelcomeModal from '../components/ThemeWelcomeModal';
import FilmStamp from '../components/FilmStamp';
import FormatTag from '../components/FormatTag';
import { loadFriendIds, onFriendsChanged } from '../lib/friends';
import NotificationsModal from '../components/NotificationsModal';
import { useNotifications } from '../context/NotificationsContext';
import { Text, TextInput } from '../components/Themed';
import { colors, bubbly } from '../theme';
import Wave, { WAVE_HEIGHT } from '../components/Wave';
import { TAB_BAR_CLEARANCE } from '../components/SeaTabBar';
import SandGrain from '../components/SandGrain';
import Wordmark from '../components/Wordmark';
import ShareCardModal from '../components/ShareCardModal';
import OchoLoader from '../components/OchoLoader';
import { useTapTabToTop } from '../lib/useTapTabToTop';
import OchoIcon from '../components/OchoIcon';
import Stamp from '../components/Stamp';
import FilmFrame from '../components/FilmFrame';
import { ReviewCover } from '../components/ModerationCovers';
import CommentRow, { CommentItem, ReplyingTo, removedWith, threadComments } from '../components/CommentRow';
import { useModeration } from '../context/ModerationContext';

type Theme = {
  id: string;
  name: string;
  end_date: string;
  recommended_films?: string | null;
  example_image_url?: string | null;
};

type Submission = {
  id: string;
  user_id: string;
  image_url: string;
  format: 'digital' | 'film';
  caption: string;
  film_stamp: string | null;
  film_strip: boolean;
  vote_count: number;
  like_count: number;
  created_at: string;
  username: string;
  avatar_url: string | null;
};

type Comment = {
  id: string;
  submission_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  username: string;
};

type Feed = 'friends' | 'global';

const SUBMISSION_COLUMNS = 'id, user_id, image_url, format, caption, film_stamp, film_strip, vote_count, like_count, created_at';

// Search order: exact name, then names starting with the query, then a later
// word starting with it (after _ . - or a digit), then anything containing it
function searchRank(username: string, query: string) {
  const name = username.toLowerCase();
  const q = query.toLowerCase();
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (new RegExp(`(^|[_.\\-0-9])${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(name)) return 2;
  return 3;
}

// Splits a username so the part matching the query can be bolded
function highlightMatch(username: string, query: string) {
  const at = query ? username.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (at < 0) return [{ text: username, match: false }];
  return [
    { text: username.slice(0, at), match: false },
    { text: username.slice(at, at + query.length), match: true },
    { text: username.slice(at + query.length), match: false },
  ].filter((p) => p.text);
}

const DOUBLE_TAP_WINDOW_MS = 300;
const PAGE_SIZE = 8;

const clampRatio = (width: number, height: number) => Math.min(Math.max(width / height, 0.5), 2);

// Each photo's shape, looked up before it's shown, so cards are the right
// height from the start instead of jumping when the image finishes loading
function measureAspectRatios(rows: Array<{ id: string; image_url: string }>) {
  return Promise.all(
    rows.map(
      (row) =>
        new Promise<[string, number] | null>((resolve) => {
          const timer = setTimeout(() => resolve(null), 2500);
          Image.getSize(
            row.image_url,
            (width, height) => {
              clearTimeout(timer);
              resolve(width && height ? [row.id, clampRatio(width, height)] : null);
            },
            () => {
              clearTimeout(timer);
              resolve(null);
            }
          );
        })
    )
  ).then((entries) => Object.fromEntries(entries.filter((e): e is [string, number] => !!e)));
}

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const [theme, setTheme] = useState<Theme | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  // the photo whose vote sheet is open
  const [voteTarget, setVoteTarget] = useState<{ id: string; username: string } | null>(null);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<Feed>('friends');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [shareItem, setShareItem] = useState<Submission | null>(null);
  const [hasSubmittedThisTheme, setHasSubmittedThisTheme] = useState(false);
  const [aspectRatios, setAspectRatios] = useState<Record<string, number>>({});

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; username: string; avatar_url: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [notifVisible, setNotifVisible] = useState(false);
  const { unread } = useNotifications();

  const [commentSubmissionId, setCommentSubmissionId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  // the comment you're answering, if you tapped Reply
  const [replyTo, setReplyTo] = useState<{ id: string; parent_id: string | null; username: string } | null>(null);
  const [commentsLoading, setCommentsLoading] = useState(false);

  const [burstId, setBurstId] = useState<string | null>(null);
  const lastTapRef = useRef<Record<string, number>>({});
  const singleTapTimeoutRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const currentThemeIdRef = useRef<string | null>(null);
  // Whose posts the current feed shows: you plus your friends, or null for everyone
  const feedUserIdsRef = useRef<string[] | null>(null);

  // The theme banner and feed toggle fold away while you scroll through
  // photos, leaving just the title and daily strip on the water
  const listRef = useRef<FlatList<Submission>>(null);
  const headerProgress = useRef(new Animated.Value(1)).current; // 1 = open
  const [headerHeight, setHeaderHeight] = useState(0);
  const headerOpenRef = useRef(true);
  const lastOffsetRef = useRef(0);
  // Only the user's own scrolling moves the header. When the header folds,
  // the list grows and can nudge its offset, which mustn't reopen it.
  const userScrollingRef = useRef(false);

  const setHeaderOpen = useCallback(
    (open: boolean) => {
      if (headerOpenRef.current === open) return;
      headerOpenRef.current = open;
      Animated.timing(headerProgress, {
        toValue: open ? 1 : 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        // Only transform and opacity move, so it runs natively and never
        // resizes the list mid-scroll
        useNativeDriver: true,
      }).start();
    },
    [headerProgress]
  );
  const headerOffset = headerProgress.interpolate({ inputRange: [0, 1], outputRange: [-headerHeight, 0] });

  const onFeedScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const dy = y - lastOffsetRef.current;
    lastOffsetRef.current = y;
    if (!userScrollingRef.current) return;
    if (dy > 2 && y > 40) setHeaderOpen(false);
    else if (y < 30 && dy < 0) setHeaderOpen(true);
  };

  // A fresh feed starts at the top, so show the banner and toggle again
  useEffect(() => {
    setHeaderOpen(true);
  }, [feed, setHeaderOpen]);

  const scrollToTop = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setHeaderOpen(true);
  };

  // Tapping the Home tab while you're already here takes you back to the top
  useTapTabToTop(scrollToTop);

  // Daily freelance photos strip (BeReal-style, no theme, just today's posts)
  const [dailyPhotos, setDailyPhotos] = useState<
    Array<{ id: string; user_id: string; image_url: string; username: string }>
  >([]);
  const [dailyViewer, setDailyViewer] = useState<{ id: string; user_id: string; image_url: string; username: string } | null>(null);

  // Weekly winners reveal
  const [winnersVisible, setWinnersVisible] = useState(false);
  const [winnersThemeName, setWinnersThemeName] = useState('');
  const [winners, setWinners] = useState<Winner[]>([]);

  const [themeWelcomeVisible, setThemeWelcomeVisible] = useState(false);
  // iOS can only present one modal at a time; trying to open two at once can
  // leave an invisible layer that blocks every tap. So the theme welcome waits
  // until the weekly results have been checked (and closed, if they showed).
  const [welcomeReady, setWelcomeReady] = useState(false);

  const attachUsernamesAndComments = async (rows: Submission[]) => {
    if (rows.length === 0) return rows;

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', rows.map((r) => r.user_id));
    const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

    return rows.map((r) => ({
      ...r,
      username: profileById.get(r.user_id)?.username ?? 'unknown',
      avatar_url: profileById.get(r.user_id)?.avatar_url ?? null,
    }));
  };

  // One page of this theme's submissions for the current feed
  const fetchSubmissionsPage = (themeId: string, from: number) => {
    let query = supabase.from('submissions').select(SUBMISSION_COLUMNS).eq('theme_id', themeId);
    if (feedUserIdsRef.current) query = query.in('user_id', feedUserIdsRef.current);
    return query.order('created_at', { ascending: false }).range(from, from + PAGE_SIZE - 1);
  };

  const loadFirstPage = useCallback(
    async (selectedFeed: Feed) => {
      setErrorMessage(null);

      await ensureCurrentTheme();
      const nowIso = new Date().toISOString();
      const { data: themeData, error: themeError } = await supabase
        .from('themes')
        .select('id, name, end_date, recommended_films, example_image_url')
        .lte('start_date', nowIso)
        .gte('end_date', nowIso)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (themeError) {
        setErrorMessage(themeError.message);
        return;
      }

      setTheme(themeData);
      currentThemeIdRef.current = themeData?.id ?? null;

      // Show the "new theme" welcome screen once per theme, per device.
      if (themeData) {
        const welcomeKey = `seenThemeWelcome:${themeData.id}`;
        const alreadySeenWelcome = await AsyncStorage.getItem(welcomeKey);
        if (!alreadySeenWelcome) {
          setThemeWelcomeVisible(true);
          await AsyncStorage.setItem(welcomeKey, 'true');
        }
      }

      if (!themeData) {
        setSubmissions([]);
        setHasSubmittedThisTheme(false);
        setHasMore(false);
        return;
      }

      if (user) {
        const { data: mine } = await supabase
          .from('submissions')
          .select('id')
          .eq('theme_id', themeData.id)
          .eq('user_id', user.id)
          .maybeSingle();
        setHasSubmittedThisTheme(!!mine);
      }

      feedUserIdsRef.current =
        selectedFeed === 'friends' && user ? [user.id, ...(await loadFriendIds(user.id))] : null;

      const { data: submissionsData, error: submissionsError } = await fetchSubmissionsPage(themeData.id, 0);

      if (submissionsError) {
        setErrorMessage(submissionsError.message);
        return;
      }

      const rows = (submissionsData ?? []) as Submission[];
      const [withProfiles, ratios] = await Promise.all([attachUsernamesAndComments(rows), measureAspectRatios(rows)]);
      setAspectRatios(ratios);
      setSubmissions(withProfiles);
      setHasMore(rows.length === PAGE_SIZE);

      if (rows.length > 0) {
        const { data: commentRows } = await supabase
          .from('comments')
          .select('submission_id')
          .in('submission_id', rows.map((r) => r.id));
        const counts: Record<string, number> = {};
        (commentRows ?? []).forEach((c) => {
          counts[c.submission_id] = (counts[c.submission_id] ?? 0) + 1;
        });
        setCommentCounts(counts);
      } else {
        setCommentCounts({});
      }

    },
    [user]
  );

  const loadMore = async () => {
    if (isLoadingMore || !hasMore || !currentThemeIdRef.current) return;
    setIsLoadingMore(true);

    const { data, error } = await fetchSubmissionsPage(currentThemeIdRef.current, submissions.length);

    if (!error && data) {
      const rows = data as Submission[];
      const [withProfiles, ratios] = await Promise.all([attachUsernamesAndComments(rows), measureAspectRatios(rows)]);
      setAspectRatios((prev) => ({ ...prev, ...ratios }));
      setSubmissions((prev) => [...prev, ...withProfiles]);
      setHasMore(rows.length === PAGE_SIZE);

      if (rows.length > 0) {
        const { data: commentRows } = await supabase
          .from('comments')
          .select('submission_id')
          .in('submission_id', rows.map((r) => r.id));
        setCommentCounts((prev) => {
          const next = { ...prev };
          (commentRows ?? []).forEach((c) => {
            next[c.submission_id] = (next[c.submission_id] ?? 0) + 1;
          });
          return next;
        });
      }
    }

    setIsLoadingMore(false);
  };

  useEffect(() => {
    setIsLoading(true);
    loadFirstPage(feed).finally(() => setIsLoading(false));
  }, [feed, loadFirstPage]);

  // New or removed friends change what the Friends feed shows
  useEffect(
    () =>
      onFriendsChanged(() => {
        if (feed === 'friends') loadFirstPage('friends');
      }),
    [feed, loadFirstPage]
  );

  // Load today's freelance daily photos from everyone, BeReal-style
  const loadDailyPhotos = useCallback(async () => {
    const today = localDateString();
    const { data } = await supabase
      .from('daily_submissions')
      .select('id, user_id, image_url')
      .eq('submission_date', today)
      .order('created_at', { ascending: false })
      .limit(20);

    const rows = data ?? [];
    if (rows.length === 0) {
      setDailyPhotos([]);
      return;
    }

    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', rows.map((r) => r.user_id));
    const usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));

    setDailyPhotos(
      rows.map((r) => ({
        id: r.id,
        user_id: r.user_id,
        image_url: r.image_url,
        username: usernameById.get(r.user_id) ?? 'unknown',
      }))
    );
  }, []);

  // Re-run every time the Home tab comes into focus (not just on first mount),
  // so a daily photo posted from the Camera tab shows up right away without
  // needing a full app reload.
  useFocusEffect(
    useCallback(() => {
      loadDailyPhotos();
    }, [loadDailyPhotos])
  );

  // Pay out any themes that have ended (server-side, safe to call from every
  // client — each theme is only ever paid once), then show the most recent
  // results if this device hasn't seen them yet.
  useEffect(() => {
    // Returns whether the results modal was shown
    const checkWeeklyWinners = async (): Promise<boolean> => {
      const { error: payoutError } = await supabase.rpc('process_due_payouts');
      if (payoutError) console.log('Payout check failed:', payoutError.message);

      const { data: endedTheme } = await supabase
        .from('themes')
        .select('id, name')
        .lt('end_date', new Date().toISOString())
        .eq('results_processed', true)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!endedTheme) return false;

      const seenKey = `seenResults:${endedTheme.id}`;
      const alreadySeen = await AsyncStorage.getItem(seenKey);
      if (alreadySeen) return false;

      const { data: results } = await supabase
        .from('theme_results')
        .select('submission_id, user_id, format, place, vote_count, reward')
        .eq('theme_id', endedTheme.id);

      const rows = results ?? [];
      const [{ data: categoryResults }, categories, { data: likeResult }] = await Promise.all([
        supabase
          .from('theme_category_results')
          .select('category, submission_id, user_id, vote_count, reward')
          .eq('theme_id', endedTheme.id),
        loadVoteCategories(),
        supabase.from('theme_like_results').select('submission_id, user_id, like_count, reward').eq('theme_id', endedTheme.id),
      ]);
      // the most-liked photo shows as one more "category", first in line
      const categoryRows = [
        ...(likeResult ?? []).map((r) => ({
          category: 'most_liked',
          submission_id: r.submission_id,
          user_id: r.user_id,
          vote_count: r.like_count,
          reward: r.reward,
        })),
        ...(categoryResults ?? []),
      ];
      if (rows.length === 0 && categoryRows.length === 0) {
        await AsyncStorage.setItem(seenKey, 'true');
        return false;
      }

      const userIds = [...rows, ...categoryRows].map((r) => r.user_id);
      const submissionIds = [...rows, ...categoryRows].map((r) => r.submission_id);
      const [{ data: profileRows }, { data: submissionRows }] = await Promise.all([
        supabase.from('profiles').select('id, username').in('id', userIds),
        supabase.from('submissions').select('id, image_url, format').in('id', submissionIds),
      ]);
      const usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
      const imageById = new Map((submissionRows ?? []).map((s) => [s.id, s.image_url]));

      const winnersList: Winner[] = rows.map((r) => ({
        submissionId: r.submission_id,
        place: r.place as Winner['place'],
        format: r.format as 'digital' | 'film',
        isTie: rows.some((o) => o !== r && o.place === r.place),
        username: usernameById.get(r.user_id) ?? 'unknown',
        imageUrl: imageById.get(r.submission_id) ?? '',
        voteCount: r.vote_count,
        reward: r.reward,
      }));

      // Build up to the win: 5th place first
      winnersList.sort((a, b) => b.place - a.place);

      // Category winners come first, then the overall countdown
      const formatById = new Map((submissionRows ?? []).map((s) => [s.id, s.format]));
      const labelById = new Map([['most_liked', 'Most liked'], ...categories.map((c) => [c.id, c.label] as [string, string])]);
      const categoryWinners: Winner[] = categoryRows.map((r) => ({
        submissionId: r.submission_id,
        place: 1,
        format: (formatById.get(r.submission_id) ?? 'digital') as 'digital' | 'film',
        isTie: false,
        username: usernameById.get(r.user_id) ?? 'unknown',
        imageUrl: imageById.get(r.submission_id) ?? '',
        voteCount: r.vote_count,
        reward: r.reward,
        category: labelById.get(r.category) ?? r.category,
        countsLikes: r.category === 'most_liked',
      }));
      winnersList.unshift(...categoryWinners);

      setWinnersThemeName(endedTheme.name);
      setWinners(winnersList);
      setWinnersVisible(true);
      await AsyncStorage.setItem(seenKey, 'true');
      return true;
    };

    checkWeeklyWinners()
      .then((shown) => {
        if (!shown) setWelcomeReady(true);
      })
      .catch(() => setWelcomeReady(true));
  }, []);

  // Real username search across every user, not just what's currently loaded in the feed
  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    let stale = false;
    const timeout = setTimeout(async () => {
      // % and _ are wildcards in ilike, so match them literally
      const literal = query.replace(/[\\%_]/g, (c) => `\\${c}`);
      const [starts, contains] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').ilike('username', `${literal}%`).limit(20),
        // one letter only looks at the start of names; more widens the net
        query.length > 1
          ? supabase.from('profiles').select('id, username, avatar_url').ilike('username', `%${literal}%`).limit(40)
          : Promise.resolve({ data: [] as typeof searchResults }),
      ]);
      if (stale) return;

      const seen = new Set<string>();
      const merged = [...(starts.data ?? []), ...(contains.data ?? [])].filter((r) => !seen.has(r.id) && seen.add(r.id));
      setSearchResults(merged.sort((a, b) => searchRank(a.username, query) - searchRank(b.username, query) || a.username.localeCompare(b.username)).slice(0, 20));
      setIsSearching(false);
    }, 250);

    return () => {
      stale = true;
      clearTimeout(timeout);
    };
  }, [searchQuery]);

  const goToUserProfile = (userId: string) => {
    setSearchVisible(false);
    setSearchQuery('');
    navigation.push('UserProfile', { userId });
  };

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadFirstPage(feed);
    setIsRefreshing(false);
  };

  const isOwnSubmission = (submissionId: string) =>
    submissions.find((s) => s.id === submissionId)?.user_id === user?.id;

  // Voting happens on the theme's last day: one overall vote plus one per
  // category, picked from the vote sheet
  const phase = themePhase(theme?.end_date);
  const votes = useThemeVotes(theme?.id, user?.id, (from, to) =>
    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === from ? { ...s, vote_count: s.vote_count - 1 } : s.id === to ? { ...s, vote_count: s.vote_count + 1 } : s
      )
    )
  );

  // Blocked accounts drop out of the feed, the daily strip and comments
  const moderation = useModeration();
  const visibleSubmissions = submissions.filter((s) => !moderation.isBlocked(s.user_id));
  const visibleDaily = dailyPhotos.filter((d) => !moderation.isBlocked(d.user_id));
  const visibleComments = threadComments(comments, moderation.isBlocked);

  // Hearts: any time during the theme, kept on your profile to vote from later
  const likes = useLikes(user?.id, (id, delta) =>
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, like_count: s.like_count + delta } : s)))
  );
  // Likes made or removed elsewhere (a photo's page, your profile) show up here too
  useFocusEffect(
    useCallback(() => {
      likes.reload();
    }, [likes.reload])
  );

  const handleHeartTap = (item: Submission) => {
    if (isOwnSubmission(item.id)) {
      Alert.alert('That\u2019s your photo', 'Your friends can like it, though!');
      return;
    }
    likes.toggle(item.id);
  };

  const openVoting = (item: Submission) => {
    if (isOwnSubmission(item.id)) {
      Alert.alert('That\u2019s your photo', 'You can\u2019t vote for your own photo, but your friends can!');
      return;
    }
    if (phase !== 'vote') {
      const opens = theme ? votingOpensAt(theme.end_date) : null;
      Alert.alert(
        'Voting day is coming',
        opens
          ? `Voting opens ${opens.toLocaleDateString(undefined, { weekday: 'long' })} at ${opens.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}, the theme\u2019s last day. Until then, scroll, comment and get inspired.`
          : 'Voting happens on the last day of each theme.'
      );
      return;
    }
    setVoteTarget({ id: item.id, username: item.username });
  };

  // Single tap opens the full detail screen; a second tap within the window
  // cancels that and likes the photo instead (Instagram-style double-tap).
  const handleImageTap = (submissionId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[submissionId] ?? 0;

    if (now - lastTap < DOUBLE_TAP_WINDOW_MS) {
      const pendingTimeout = singleTapTimeoutRef.current[submissionId];
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        delete singleTapTimeoutRef.current[submissionId];
      }
      // Double-tap likes the photo (not your own)
      if (!isOwnSubmission(submissionId) && phase !== 'ended') {
        likes.like(submissionId);
        setBurstId(submissionId);
        setTimeout(() => setBurstId((current) => (current === submissionId ? null : current)), 700);
      }
      lastTapRef.current[submissionId] = 0;
    } else {
      lastTapRef.current[submissionId] = now;
      singleTapTimeoutRef.current[submissionId] = setTimeout(() => {
        navigation.push('SubmissionDetail', { submissionId });
        delete singleTapTimeoutRef.current[submissionId];
      }, DOUBLE_TAP_WINDOW_MS);
    }
  };

  const openComments = async (submissionId: string) => {
    setCommentSubmissionId(submissionId);
    setReplyTo(null);
    setCommentsLoading(true);
    const { data } = await supabase
      .from('comments')
      .select('id, submission_id, user_id, body, created_at, parent_id')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });

    const rows = data ?? [];
    let usernameById = new Map<string, string>();
    if (rows.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, username')
        .in('id', rows.map((r) => r.user_id));
      usernameById = new Map((profileRows ?? []).map((p) => [p.id, p.username]));
    }
    setComments(rows.map((r) => ({ ...r, username: usernameById.get(r.user_id) ?? 'unknown' })));
    setCommentsLoading(false);
  };

  const postComment = async () => {
    if (!user || !commentSubmissionId || !commentInput.trim()) return;
    const body = commentInput.trim();
    setCommentInput('');
    // replies join the thread of the comment they answer
    const parentId = replyTo ? (replyTo.parent_id ?? replyTo.id) : null;
    setReplyTo(null);

    const { data, error } = await supabase
      .from('comments')
      .insert({ submission_id: commentSubmissionId, user_id: user.id, body, parent_id: parentId })
      .select('id, submission_id, user_id, body, created_at, parent_id')
      .single();

    if (!error && data) {
      setComments((prev) => [...prev, { ...data, username: user.username }]);
      setCommentCounts((prev) => ({
        ...prev,
        [commentSubmissionId]: (prev[commentSubmissionId] ?? 0) + 1,
      }));
    } else if (error) {
      console.log('Comment failed:', error.message);
    }
  };

  const startReply = (c: CommentItem) => {
    setReplyTo({ id: c.id, parent_id: c.parent_id, username: c.username });
    setCommentInput(`@${c.username} `);
  };

  // A deleted comment takes its replies with it
  const commentDeleted = (c: CommentItem) => {
    const gone = removedWith(comments, c.id);
    setComments((prev) => prev.filter((x) => !gone.has(x.id)));
    if (commentSubmissionId) {
      setCommentCounts((prev) => ({
        ...prev,
        [commentSubmissionId]: Math.max(0, (prev[commentSubmissionId] ?? 0) - gone.size),
      }));
    }
  };

  // Opens the share card: pick a style, add a message, send it anywhere
  const shareSubmission = (item: Submission) => setShareItem(item);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* Title and daily strip stay put; everything below slides up under them */}
      <View style={styles.fixedTop}>
        <View style={styles.topBar}>
          <View style={styles.topBarSide} />
          <Pressable onPress={scrollToTop} hitSlop={6}>
            <Wordmark size={27} />
          </Pressable>
          <View style={[styles.topBarSide, styles.topBarIcons]}>
            <Pressable onPress={() => setSearchVisible((v) => !v)}>
              <OchoIcon name="search" size={22} color={colors.ink} />
            </Pressable>
            <Pressable onPress={() => setNotifVisible(true)} style={{ marginLeft: 14 }} hitSlop={8}>
              <OchoIcon name="bell" size={22} color={colors.ink} filled={unread > 0} detail={colors.sea} />
              {unread > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unread > 9 ? '9+' : unread}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {searchVisible && (
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.muted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search users by username"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <Pressable onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={16} color={colors.faint} />
                </Pressable>
              )}
            </View>

            {searchQuery.trim() !== '' && (
              <View style={styles.searchResultsPanel}>
                {isSearching ? (
                  <ActivityIndicator style={{ marginVertical: 12 }} color={colors.deep} />
                ) : searchResults.length === 0 ? (
                  <Text style={styles.searchEmptyText}>No users found for "{searchQuery}"</Text>
                ) : (
                  searchResults.map((result) => (
                    <Pressable
                      key={result.id}
                      style={styles.searchResultRow}
                      onPress={() => goToUserProfile(result.id)}
                    >
                      {result.avatar_url ? (
                        <Image source={{ uri: result.avatar_url }} style={styles.searchResultAvatar} />
                      ) : (
                        <View style={styles.searchResultAvatar} />
                      )}
                      <Text style={styles.searchResultUsername}>
                        {highlightMatch(result.username, searchQuery.trim()).map((part, i) => (
                          <Text key={i} style={part.match ? styles.searchMatch : undefined}>
                            {part.text}
                          </Text>
                        ))}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.faint} />
                    </Pressable>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {visibleDaily.length > 0 && (
          <View style={styles.dailyStripWrap}>
            <Text style={styles.dailyStripLabel}>Today, around the app</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
              {visibleDaily.map((d) => (
                <Pressable key={d.id} onPress={() => !moderation.coverFor(d.id, d.user_id) && setDailyViewer(d)}>
                  <View style={styles.dailyThumb}>
                    <Image source={{ uri: d.image_url }} style={StyleSheet.absoluteFill} />
                    {moderation.coverFor(d.id, d.user_id) && <ReviewCover kind={moderation.coverFor(d.id, d.user_id)!} compact />}
                  </View>
                  <Text style={styles.dailyThumbUsername} numberOfLines={1}>{d.username}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

      </View>

      <Animated.View
        style={[
          styles.slider,
          // Taller than the screen by the banner's height, so sliding up never leaves a gap
          { marginBottom: -headerHeight, transform: [{ translateY: headerOffset }] },
        ]}
      >
        <Animated.View
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
          style={{ opacity: headerProgress }}
        >
          <View style={styles.themeBanner}>
            <Text style={styles.themeLabel}>THIS WEEK'S THEME</Text>
            {theme ? (
              <Text style={styles.themeName}>{theme.name}</Text>
            ) : isLoading ? (
              <ActivityIndicator style={styles.themeLoading} color={colors.deep} />
            ) : (
              <Text style={styles.themeName}>No active theme</Text>
            )}
            {theme && <Stamp style={styles.themeCountdown}>{themeStatus(theme.end_date).toUpperCase()}</Stamp>}
            {hasSubmittedThisTheme && (
              <View style={styles.submittedPill}>
                <Ionicons name="checkmark-circle" size={13} color="#166534" />
                <Text style={styles.submittedText}>Your submission is in</Text>
              </View>
            )}
          </View>

          <View style={styles.toggleRow}>
            <Pressable
              style={[styles.toggle, feed === 'friends' && styles.toggleActive]}
              onPress={() => setFeed('friends')}
            >
              <Text style={feed === 'friends' ? styles.toggleTextActive : styles.toggleText}>
                Friends
              </Text>
            </Pressable>
            <Pressable
              style={[styles.toggle, feed === 'global' && styles.toggleActive]}
              onPress={() => setFeed('global')}
            >
              <Text style={feed === 'global' ? styles.toggleTextActive : styles.toggleText}>
                Global
              </Text>
            </Pressable>
          </View>

        </Animated.View>

        <View style={styles.feedWrap}>
          <SandGrain />
          <Wave />
          {isLoading ? (
            <View style={styles.centered}>
              <OchoLoader message="Ocho is fetching this week’s photos…" />
            </View>
          ) : errorMessage ? (
            <View style={styles.centered}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              style={styles.feedSheet}
              contentContainerStyle={{ paddingTop: WAVE_HEIGHT, paddingBottom: TAB_BAR_CLEARANCE }}
              data={visibleSubmissions}
              onScroll={onFeedScroll}
              scrollEventThrottle={16}
              onScrollBeginDrag={() => (userScrollingRef.current = true)}
              onMomentumScrollBegin={() => (userScrollingRef.current = true)}
              onScrollEndDrag={() => (userScrollingRef.current = false)}
              onMomentumScrollEnd={() => (userScrollingRef.current = false)}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />}
              onEndReachedThreshold={0.6}
              onEndReached={loadMore}
              ListFooterComponent={
                isLoadingMore ? <OchoLoader size={44} compact /> : undefined
              }
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>
                    {feed === 'friends'
                      ? 'Nothing from your friends for this theme yet. Add friends from their profiles, or check Global.'
                      : 'No photos for this theme yet. Water you waiting for?'}
                  </Text>
                  {feed === 'friends' && (
                    <Pressable style={styles.emptyButton} onPress={() => setFeed('global')}>
                      <Text style={styles.emptyButtonText}>Sea the photos in Global</Text>
                    </Pressable>
                  )}
                </View>
              }
              renderItem={({ item }) => {
                const overallHere = votes.mine.overall === item.id;
                // how many of your category votes this photo has
                const picksHere = Object.entries(votes.mine).filter(([c, id]) => c !== 'overall' && id === item.id).length;
                const cover = moderation.coverFor(item.id, item.user_id);
                return (
                  <View style={styles.card}>
                    <Pressable
                      style={styles.cardHeaderTouchable}
                      onPress={() => navigation.push('UserProfile', { userId: item.user_id })}
                    >
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                      ) : (
                        <View style={styles.avatar} />
                      )}
                      <Text style={styles.username}>{item.username}</Text>
                      <FormatTag format={item.format} />
                      {item.user_id !== user?.id && (
                        <Pressable
                          style={styles.cardMenu}
                          hitSlop={10}
                          onPress={() =>
                            moderation.openContentMenu({ kind: 'photo', id: item.id, userId: item.user_id, username: item.username })
                          }
                        >
                          <OchoIcon name="more" size={20} color={colors.muted} />
                        </Pressable>
                      )}
                    </Pressable>

                    <Pressable style={styles.photoWrap} onPress={() => !cover && handleImageTap(item.id)}>
                      <FilmFrame film={item.format === 'film' && item.film_strip !== false} frame={`${(visibleSubmissions.indexOf(item) % 36) + 1}A`}>
                      <Image
                        source={{ uri: item.image_url }}
                        style={[styles.image, { aspectRatio: aspectRatios[item.id] ?? 1 }]}
                        onLoad={(e) => {
                          const { width, height } = e.nativeEvent.source;
                          // Backup for photos that couldn't be measured up front
                          if (width && height && !aspectRatios[item.id]) {
                            const ratio = clampRatio(width, height);
                            setAspectRatios((prev) => ({ ...prev, [item.id]: ratio }));
                          }
                        }}
                      />
                      </FilmFrame>
                      {item.film_stamp && (
                        <View style={[styles.stampOverlay, item.format === 'film' && item.film_strip !== false && styles.stampOverlayFilm]} pointerEvents="none">
                          <FilmStamp stock={item.film_stamp} />
                        </View>
                      )}
                      {burstId === item.id && (
                        <View style={styles.burstOverlay} pointerEvents="none">
                          <Ionicons name="heart" size={80} color={colors.white} />
                        </View>
                      )}
                      {cover && <ReviewCover kind={cover} />}
                    </Pressable>

                    {item.caption ? (
                      <Text style={styles.caption}>
                        <Text style={styles.captionUsername}>{item.username}</Text> {item.caption}
                      </Text>
                    ) : null}

                    <View style={styles.actionsRow}>
                      <Pressable style={styles.actionItem} onPress={() => handleHeartTap(item)}>
                        <OchoIcon
                          name="heart"
                          size={22}
                          color={likes.liked.has(item.id) ? colors.coral : colors.text}
                          filled={likes.liked.has(item.id)}
                        />
                        <Stamp style={styles.actionCount}>{item.like_count}</Stamp>
                      </Pressable>
                      {phase === 'vote' ? (
                        <Pressable
                          style={[styles.voteButton, (overallHere || picksHere > 0) && styles.voteButtonActive]}
                          onPress={() => openVoting(item)}
                        >
                          <OchoIcon
                            name="vote"
                            size={17}
                            color={overallHere || picksHere > 0 ? colors.white : colors.coral}
                            filled={overallHere}
                          />
                          <Text style={[styles.voteButtonText, (overallHere || picksHere > 0) && styles.voteButtonTextActive]}>
                            {overallHere || picksHere > 0
                              ? `${(overallHere ? 1 : 0) + picksHere} of your votes`
                              : 'Vote'}
                          </Text>
                        </Pressable>
                      ) : (
                        <Pressable style={styles.votingSoon} onPress={() => openVoting(item)}>
                          <Ionicons name="time-outline" size={14} color={colors.muted} />
                          <Text style={styles.votingSoonText}>Voting day soon</Text>
                        </Pressable>
                      )}
                      <Pressable style={styles.actionItem} onPress={() => openComments(item.id)}>
                        <OchoIcon name="comment" size={21} color={colors.text} />
                        <Stamp style={styles.actionCount}>{commentCounts[item.id] ?? 0}</Stamp>
                      </Pressable>
                      <Pressable style={{ marginLeft: 'auto' }} onPress={() => shareSubmission(item)}>
                        <OchoIcon name="share" size={22} color={colors.text} />
                      </Pressable>
                    </View>
                  </View>
                );
              }}
            />
          )}
        </View>
      </Animated.View>

      <Modal visible={!!commentSubmissionId} animationType="slide" transparent onRequestClose={() => setCommentSubmissionId(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.commentSheet}>
            <View style={styles.commentSheetHeader}>
              <Text style={styles.commentSheetTitle}>Comments</Text>
              <Pressable onPress={() => setCommentSubmissionId(null)}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>

            {commentsLoading ? (
              <OchoLoader size={48} message="Ocho is fetching the comments…" />
            ) : (
              <FlatList
                data={visibleComments}
                keyExtractor={(c) => c.id}
                style={{ maxHeight: 320 }}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>No comments yet. Say something nice.</Text>
                }
                renderItem={({ item }) => (
                  <CommentRow
                    comment={item}
                    isReply={item.isReply}
                    photoOwnerId={submissions.find((s) => s.id === commentSubmissionId)?.user_id}
                    onOpenProfile={(userId) => {
                      setCommentSubmissionId(null);
                      navigation.push('UserProfile', { userId });
                    }}
                    onReply={startReply}
                    onDeleted={commentDeleted}
                    beforeReport={() => setCommentSubmissionId(null)}
                    inset={0}
                  />
                )}
              />
            )}

            {replyTo && (
              <ReplyingTo
                username={replyTo.username}
                onCancel={() => {
                  setReplyTo(null);
                  setCommentInput('');
                }}
              />
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder={replyTo ? `Reply to ${replyTo.username}` : 'Add a comment'}
                value={commentInput}
                onChangeText={setCommentInput}
              />
              <Pressable style={styles.commentSendButton} onPress={postComment}>
                <Ionicons name="send" size={16} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <NotificationsModal
        visible={notifVisible}
        onClose={() => setNotifVisible(false)}
        onOpenSubmission={(submissionId) => {
          setNotifVisible(false);
          navigation.push('SubmissionDetail', { submissionId });
        }}
        onOpenProfile={(userId) => {
          setNotifVisible(false);
          navigation.push('UserProfile', { userId });
        }}
      />

      <Modal visible={!!dailyViewer} transparent animationType="fade" onRequestClose={() => setDailyViewer(null)}>
        <Pressable style={styles.dailyViewerBackdrop} onPress={() => setDailyViewer(null)}>
          {dailyViewer && (
            <Image source={{ uri: dailyViewer.image_url }} style={styles.dailyViewerImage} resizeMode="contain" />
          )}
          <Pressable style={styles.dailyViewerCloseButton} onPress={() => setDailyViewer(null)}>
            <Ionicons name="close" size={22} color={colors.white} />
          </Pressable>
          {dailyViewer && dailyViewer.user_id !== user?.id && (
            <Pressable
              style={[styles.dailyViewerCloseButton, styles.dailyViewerMenuButton]}
              onPress={() => {
                const d = dailyViewer;
                moderation.openContentMenu(
                  { kind: 'daily', id: d.id, userId: d.user_id, username: d.username },
                  () => setDailyViewer(null)
                );
              }}
            >
              <Ionicons name="ellipsis-horizontal" size={20} color={colors.white} />
            </Pressable>
          )}
        </Pressable>
      </Modal>

      <WeeklyWinnersModal
        visible={winnersVisible}
        themeName={winnersThemeName}
        winners={winners}
        onClose={() => {
          setWinnersVisible(false);
          // Let the results modal finish its dismiss animation first
          setTimeout(() => setWelcomeReady(true), 500);
        }}
      />

      <ThemeWelcomeModal
        visible={themeWelcomeVisible && welcomeReady}
        themeName={theme?.name ?? ''}
        recommendedFilms={theme?.recommended_films}
        exampleImageUrl={theme?.example_image_url}
        onClose={() => setThemeWelcomeVisible(false)}
      />
      <VoteSheet
        submissionId={voteTarget?.id ?? null}
        username={voteTarget?.username ?? ''}
        categories={votes.categories}
        mine={votes.mine}
        timeLeft={theme ? formatTimeLeft(new Date(theme.end_date).getTime() - Date.now()) : ''}
        onToggle={votes.toggle}
        onClose={() => setVoteTarget(null)}
      />
      <ShareCardModal
        visible={!!shareItem}
        imageUrl={shareItem?.image_url ?? null}
        username={shareItem?.username ?? ''}
        themeName={theme?.name}
        onClose={() => setShareItem(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.sea, overflow: 'hidden' },
  fixedTop: { backgroundColor: colors.sea, zIndex: 1 },
  slider: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  // Equal-width sides keep the title centred between them
  topBarSide: { flex: 1 },
  topBarIcons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: colors.shell,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 13 },
  searchWrap: { marginBottom: 4 },
  searchMatch: { fontWeight: '700', color: colors.deep },
  searchResultsPanel: {
    marginHorizontal: 16,
    marginTop: 6,
    backgroundColor: colors.shell,
    borderRadius: 10,
    paddingVertical: 4,
    maxHeight: 260,
  },
  searchEmptyText: { fontSize: 13, color: colors.faint, textAlign: 'center', paddingVertical: 14 },
  searchResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: colors.sand,
  },
  searchResultAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.reefLight },
  searchResultUsername: { flex: 1, fontSize: 14, fontWeight: '500', color: colors.ink },

  dailyStripWrap: { marginTop: 4, marginBottom: 4 },
  dailyStripLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.muted,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 16,
  },
  dailyThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.sand, overflow: 'hidden' },
  dailyThumbUsername: { fontSize: 10, color: colors.muted, marginTop: 4, width: 64, textAlign: 'center' },
  dailyViewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center' },
  dailyViewerImage: { width: '100%', height: '80%' },
  dailyViewerMenuButton: { right: undefined, left: 20 },
  dailyViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  themeBanner: { alignItems: 'flex-start', paddingVertical: 16, paddingHorizontal: 20 },
  themeLabel: { fontSize: 11, fontWeight: '600', color: colors.reefDark, letterSpacing: 1, marginBottom: 4 },
  themeName: { ...bubbly, fontSize: 30, textAlign: 'left' },
  themeLoading: { height: 38 },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.coral,
    backgroundColor: colors.coralLight,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },
  voteButtonActive: { backgroundColor: colors.coral, borderColor: colors.coral },
  voteButtonText: { fontSize: 13, fontWeight: '700', color: colors.coral },
  voteButtonTextActive: { color: colors.white },
  votingSoon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  votingSoonText: { fontSize: 12, color: colors.muted },
  themeCountdown: { fontSize: 12, marginTop: 6 },
  submittedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 8,
  },
  submittedText: { fontSize: 11, color: '#166534', fontWeight: '600' },

  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 4,
    backgroundColor: colors.sandTrack,
    borderRadius: 20,
    padding: 3,
  },
  toggle: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 18 },
  toggleActive: { backgroundColor: colors.shell },
  toggleText: { fontSize: 13, color: colors.muted },
  toggleTextActive: { fontSize: 13, fontWeight: '600', color: colors.deep },

  feedWrap: { flex: 1, backgroundColor: colors.shell },
  feedSheet: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, paddingHorizontal: 30 },
  errorText: { color: '#b91c1c', fontSize: 13, textAlign: 'center' },
  emptyText: { color: colors.faint, fontSize: 13, textAlign: 'center' },
  emptyButton: { marginTop: 12, backgroundColor: colors.coral, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  emptyButtonText: { fontSize: 13, color: colors.white, fontWeight: '600' },

  // photos run nearly edge to edge; the text around them keeps its margin
  card: { paddingTop: 16 },
  photoWrap: { marginHorizontal: 6 },
  cardHeaderTouchable: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, paddingHorizontal: 14 },
  cardMenu: { marginLeft: 'auto', paddingHorizontal: 4 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.reefLight },
  username: { fontSize: 14, fontWeight: '600', color: colors.ink },
  image: { width: '100%', borderRadius: 5, backgroundColor: colors.sand },
  caption: { fontSize: 13, color: colors.text, marginTop: 8, lineHeight: 18, paddingHorizontal: 14 },
  captionUsername: { fontWeight: '600', color: colors.ink },
  stampOverlay: { position: 'absolute', left: 10, bottom: 10 },
  stampOverlayFilm: { left: 14, bottom: 25 },
  burstOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 10, paddingHorizontal: 14 },
  actionItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: 13, color: colors.text },
  actionTextActive: { color: colors.coral, fontWeight: '600' },
  actionCount: { fontSize: 14 },

  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  commentSheet: {
    backgroundColor: colors.shell,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    maxHeight: '75%',
  },
  commentSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  commentSheetTitle: { fontSize: 16, fontWeight: '600' },
  commentUsername: { fontSize: 12, fontWeight: '600', color: colors.text },
  commentBody: { fontSize: 13, color: colors.ink, marginTop: 2 },
  commentInputRow: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' },
  commentInput: {
    flex: 1,
    backgroundColor: colors.sand,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
  },
  commentSendButton: { backgroundColor: colors.coral, borderRadius: 20, padding: 10 },

  bellBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: colors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: { fontSize: 10, fontWeight: '700', color: colors.white },
});
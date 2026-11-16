import PostHog from 'posthog-react-native';

// Singleton instance, initialized once in App.tsx via initAnalytics()
let posthog: PostHog | null = null;

export async function initAnalytics(): Promise<PostHog | null> {
  const apiKey = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
  const host = process.env.EXPO_PUBLIC_POSTHOG_HOST;

  if (!apiKey) {
    console.log('PostHog: No API key set, analytics disabled.');
    return null;
  }

  posthog = new PostHog(apiKey, {
    host: host || 'https://us.i.posthog.com',
    // Flush events every 30s or when 20 events are queued
    flushInterval: 30000,
    flushAt: 20,
  });

  return posthog;
}

export function getPostHog(): PostHog | null {
  return posthog;
}

// --- Identity ---

export function identifyUser(userId: string, properties?: Record<string, any>) {
  posthog?.identify(userId, properties);
}

export function resetUser() {
  posthog?.reset();
}

// --- Event Tracking ---

export function trackEvent(event: string, properties?: Record<string, any>) {
  posthog?.capture(event, properties);
}

// --- Feature Flags ---

export async function isFeatureEnabled(flag: string): Promise<boolean> {
  if (!posthog) return false;
  return (await posthog.isFeatureEnabled(flag)) ?? false;
}

export function getFeatureFlag(flag: string): boolean | string | undefined {
  return posthog?.getFeatureFlag(flag);
}

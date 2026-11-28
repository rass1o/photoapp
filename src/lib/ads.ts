import { TurboModuleRegistry } from 'react-native';

// The ads library is native code that's only in builds made after it was
// added. Expo Go and older TestFlight builds don't have it, and importing it
// there crashes the app on launch, so it's loaded only if it's there.
let ads: typeof import('react-native-google-mobile-ads') | null = null;
try {
  if (TurboModuleRegistry.get('RNGoogleMobileAdsRewardedModule')) ads = require('react-native-google-mobile-ads');
} catch {
  ads = null;
}

// Whether this build can show ads (the restore-with-ads buttons hide if not)
export const adsAvailable = !!ads;

export interface AdServerData {
  userId: string;
  streakType: 'daily' | 'weekly';
  restoreSession: string;
}

// Rewarded Ad Unit ID: Uses Google's official test ad unit ID in development,
// or the configured production ad unit ID from environment variables.
const AD_UNIT_ID = !ads
  ? ''
  : __DEV__
    ? ads.TestIds.REWARDED
    : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || ads.TestIds.REWARDED;

/**
 * Loads and displays a single rewarded video ad configured with Server-Side Verification (S2SV).
 * Resolves when the user completes watching the ad and earns the reward.
 * Rejects if the ad fails to load, encounters an error, or is closed prematurely without reward.
 */
export function showRewardedAd(serverData: AdServerData): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!ads) {
      reject(new Error('Ads aren’t available in this version of the app'));
      return;
    }
    const { RewardedAd, RewardedAdEventType, AdEventType } = ads;
    let earned = false;
    let unsubLoaded: (() => void) | null = null;
    let unsubEarned: (() => void) | null = null;
    let unsubClosed: (() => void) | null = null;
    let unsubError: (() => void) | null = null;

    const cleanup = () => {
      if (unsubLoaded) {
        unsubLoaded();
        unsubLoaded = null;
      }
      if (unsubEarned) {
        unsubEarned();
        unsubEarned = null;
      }
      if (unsubClosed) {
        unsubClosed();
        unsubClosed = null;
      }
      if (unsubError) {
        unsubError();
        unsubError = null;
      }
    };

    try {
      const rewarded = RewardedAd.createForAdRequest(AD_UNIT_ID, {
        serverSideVerificationOptions: {
          customData: JSON.stringify(serverData),
          userId: serverData.userId,
        },
      });

      unsubLoaded = rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
        try {
          rewarded.show();
        } catch (showErr) {
          cleanup();
          reject(showErr);
        }
      });

      unsubEarned = rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        earned = true;
      });

      unsubClosed = rewarded.addAdEventListener(AdEventType.CLOSED, () => {
        cleanup();
        if (earned) {
          resolve();
        } else {
          reject(new Error('Ad closed before completion'));
        }
      });

      unsubError = rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
        cleanup();
        reject(error);
      });

      rewarded.load();
    } catch (err) {
      cleanup();
      reject(err);
    }
  });
}

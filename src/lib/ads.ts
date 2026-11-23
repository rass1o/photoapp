import {
  RewardedAd,
  RewardedAdEventType,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

export interface AdServerData {
  userId: string;
  streakType: 'daily' | 'weekly';
  restoreSession: string;
}

// Rewarded Ad Unit ID: Uses Google's official test ad unit ID in development,
// or the configured production ad unit ID from environment variables.
const AD_UNIT_ID = __DEV__
  ? TestIds.REWARDED
  : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID || TestIds.REWARDED;

/**
 * Loads and displays a single rewarded video ad configured with Server-Side Verification (S2SV).
 * Resolves when the user completes watching the ad and earns the reward.
 * Rejects if the ad fails to load, encounters an error, or is closed prematurely without reward.
 */
export function showRewardedAd(serverData: AdServerData): Promise<void> {
  return new Promise((resolve, reject) => {
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

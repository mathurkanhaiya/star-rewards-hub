import { useCallback, useRef, useEffect } from 'react';

declare global {
  interface Window {
    Adsgram?: {
      init: (config: { blockId: string; debug?: boolean }) => AdController;
    };
  }
}

interface AdController {
  show: () => Promise<{ done: boolean; description: string; state: string; error: boolean }>;
  destroy: () => void;
}

const INTERSTITIAL_ID = 'int-23322';
const REWARDED_ID = '23390';

export function useRewardedAd(onReward: () => void) {
  const adRef = useRef<AdController | null>(null);

  useEffect(() => {
    if (window.Adsgram) {
      adRef.current = window.Adsgram.init({ blockId: REWARDED_ID });
    }
    return () => {
      adRef.current?.destroy();
    };
  }, []);

  const showAd = useCallback(async (): Promise<boolean> => {
    if (!window.Adsgram) {
      // Fallback for dev/web preview — simulate ad
      await new Promise(r => setTimeout(r, 1500));
      onReward();
      return true;
    }
    if (!adRef.current) {
      adRef.current = window.Adsgram.init({ blockId: REWARDED_ID });
    }
    try {
      const result = await adRef.current.show();
      if (result.done) {
        onReward();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [onReward]);

  return { showAd };
}

export function showInterstitialAd(): Promise<boolean> {
  return new Promise(async (resolve) => {
    if (!window.Adsgram) {
      resolve(false);
      return;
    }
    try {
      const ad = window.Adsgram.init({ blockId: INTERSTITIAL_ID });
      const result = await ad.show();
      resolve(result.done);
    } catch {
      resolve(false);
    }
  });
}

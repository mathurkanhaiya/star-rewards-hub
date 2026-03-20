import { useEffect, useRef, useState } from "react";

interface AdsgramTaskProps {
  blockId: string;
  rewardAmount?: number;
  onReward?: (detail: any) => void;
  onError?: (detail: any) => void;
}

export default function AdsgramTask({
  blockId,
  rewardAmount = 10,
  onReward,
  onError,
}: AdsgramTaskProps) {
  const taskRef = useRef<HTMLElement | null>(null);

  const [state, setState] = useState<"idle" | "done" | "error" | "no_banner">("idle");

  // 🔥 CORE FIX: re-mount trigger
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;

    let isMounted = true; // ✅ prevent memory issues

    const handleReward = (e: Event) => {
      if (!isMounted) return;

      setState("done");
      onReward?.((e as CustomEvent).detail);

      // ✅ Reset + reload next ad
      setTimeout(() => {
        if (!isMounted) return;

        setState("idle");
        setReloadKey((k) => k + 1);
      }, 1200);
    };

    const handleError = (e: Event) => {
      if (!isMounted) return;

      setState("error");
      onError?.((e as CustomEvent).detail);

      setTimeout(() => {
        if (!isMounted) return;

        setState("idle");
        setReloadKey((k) => k + 1);
      }, 2500);
    };

    const handleNoBanner = () => {
      if (!isMounted) return;

      setState("no_banner");

      setTimeout(() => {
        if (!isMounted) return;

        setState("idle");
        setReloadKey((k) => k + 1);
      }, 3500);
    };

    task.addEventListener("reward", handleReward);
    task.addEventListener("error", handleError);
    task.addEventListener("bannerNotFound", handleNoBanner);

    return () => {
      isMounted = false;

      task.removeEventListener("reward", handleReward);
      task.removeEventListener("error", handleError);
      task.removeEventListener("bannerNotFound", handleNoBanner);
    };
  }, [reloadKey, onReward, onError]); // ✅ important

  return (
    <>
      <style>{`
        .ags-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: linear-gradient(135deg, #1e293b, #0f172a);
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }

        .ags-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0 16px;
        }

        .ags-left {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .ags-icon {
          width: 44px; height: 44px;
          border-radius: 13px;
          background: linear-gradient(45deg, #3b82f6, #60a5fa);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }

        .ags-title {
          font-size: 14px;
          font-weight: 700;
          color: #f3f4f6;
        }

        .ags-sub {
          font-size: 12px;
          color: #6b7280;
        }

        .ags-badge {
          font-size: 12px;
          font-weight: 700;
          color: #fbbf24;
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.25);
          padding: 4px 10px;
          border-radius: 20px;
        }

        adsgram-task {
          display: block;
          padding: 10px 16px 14px 16px;
        }

        .ags-done-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.6);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #4ade80;
          font-weight: bold;
        }

        .ags-error-bar,
        .ags-nobanner-bar {
          margin: 0 16px 12px;
          padding: 9px;
          border-radius: 12px;
          text-align: center;
          font-size: 12px;
        }

        .ags-error-bar {
          color: #f87171;
          background: rgba(220,38,38,0.15);
        }

        .ags-nobanner-bar {
          color: #9ca3af;
          background: rgba(255,255,255,0.05);
        }
      `}</style>

      <div className="ags-wrap">
        <div className="ags-header">
          <div className="ags-left">
            <div className="ags-icon">🎬</div>
            <div>
              <div className="ags-title">Watch Sponsored Video</div>
              <div className="ags-sub">Short ad • Instant reward</div>
            </div>
          </div>
          <div className="ags-badge">+{rewardAmount} pts</div>
        </div>

        {state === "error" && (
          <div className="ags-error-bar">❌ Ad unavailable</div>
        )}

        {state === "no_banner" && (
          <div className="ags-nobanner-bar">😔 No ads available</div>
        )}

        {/* 🔥 CORE FIX */}
        <adsgram-task
          key={reloadKey}
          ref={taskRef}
          data-block-id={blockId}
        />

        {state === "done" && (
          <div className="ags-done-overlay">
            ✅ +{rewardAmount} pts
          </div>
        )}
      </div>
    </>
  );
}
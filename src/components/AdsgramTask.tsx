import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/integrations/supabase/client";

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
  const { user, refreshBalance } = useApp();
  const taskRef = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<"idle" | "done" | "error" | "no_banner">("idle");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const task = taskRef.current;
    if (!task) return;
    let isMounted = true;

    const handleReward = async (e: Event) => {
      if (!isMounted) return;
      setState("done");
      onReward?.((e as CustomEvent).detail);

      // ── Credit balance ──
      if (user) {
        try {
          const { data: bal } = await supabase
            .from("balances")
            .select("points, total_earned")
            .eq("user_id", user.id)
            .single();

          if (bal) {
            await supabase
              .from("balances")
              .update({
                points: bal.points + rewardAmount,
                total_earned: bal.total_earned + rewardAmount,
              })
              .eq("user_id", user.id);

            await supabase.from("transactions").insert({
              user_id: user.id,
              type: "adsgram_task",
              points: rewardAmount,
              description: `🎬 Adsgram Task: +${rewardAmount} pts`,
            });

            await refreshBalance();
          }
        } catch (err) {
          console.error("Failed to credit reward:", err);
        }
      }

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
  }, [reloadKey, onReward, onError, user, rewardAmount, refreshBalance]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@600;700&family=Rajdhani:wght@500;600&display=swap');

        .ags-wrap {
          position: relative;
          border-radius: 20px;
          overflow: hidden;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.07);
        }
        .ags-wrap::before {
          content: '';
          position: absolute;
          top: 0; left: 10%; right: 10%;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,190,0,0.35), transparent);
          pointer-events: none;
        }
        .ags-wrap::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
          border-radius: 20px;
        }

        .ags-inner { position: relative; z-index: 1; }

        .ags-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px 0 16px;
        }
        .ags-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .ags-icon {
          width: 46px; height: 46px;
          border-radius: 14px;
          background: rgba(255,190,0,0.1);
          border: 1px solid rgba(255,190,0,0.25);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          box-shadow: 0 0 12px rgba(255,190,0,0.15);
          flex-shrink: 0;
        }
        .ags-title {
          font-family: 'Orbitron', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1px;
          color: rgba(255,255,255,0.85);
          margin-bottom: 3px;
        }
        .ags-sub {
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          letter-spacing: 0.5px;
        }
        .ags-badge {
          font-family: 'Orbitron', monospace;
          font-size: 12px;
          font-weight: 700;
          color: #ffbe00;
          background: rgba(255,190,0,0.08);
          border: 1px solid rgba(255,190,0,0.25);
          padding: 5px 12px;
          border-radius: 20px;
          letter-spacing: 1px;
          flex-shrink: 0;
          box-shadow: 0 0 10px rgba(255,190,0,0.1);
        }

        adsgram-task {
          display: block;
          padding: 10px 16px 14px 16px;
        }

        .ags-status {
          margin: 0 16px 12px;
          padding: 9px 14px;
          border-radius: 12px;
          text-align: center;
          font-family: 'Orbitron', monospace;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .ags-status.error {
          color: #f87171;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.2);
        }
        .ags-status.nobanner {
          color: rgba(255,255,255,0.25);
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
        }

        .ags-done-overlay {
          position: absolute;
          inset: 0;
          background: rgba(6,8,15,0.88);
          backdrop-filter: blur(4px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 6px;
          z-index: 10;
          border-radius: 20px;
          animation: agsFadeIn 0.2s ease;
        }
        @keyframes agsFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .ags-done-icon {
          font-size: 32px;
          animation: agsPop 0.4s cubic-bezier(0.34,1.56,0.64,1);
        }
        @keyframes agsPop {
          from { transform: scale(0.4); opacity: 0; }
          to   { transform: scale(1);   opacity: 1; }
        }
        .ags-done-label {
          font-family: 'Orbitron', monospace;
          font-size: 16px;
          font-weight: 700;
          color: #4ade80;
          letter-spacing: 2px;
          text-shadow: 0 0 16px rgba(74,222,128,0.6);
          animation: agsPop 0.4s 0.1s cubic-bezier(0.34,1.56,0.64,1) both;
        }
        .ags-done-sub {
          font-family: 'Rajdhani', sans-serif;
          font-size: 12px;
          color: rgba(74,222,128,0.5);
          letter-spacing: 2px;
        }
      `}</style>

      <div className="ags-wrap">
        <div className="ags-inner">
          <div className="ags-header">
            <div className="ags-left">
              <div className="ags-icon">🎬</div>
              <div>
                <div className="ags-title">Sponsored Video</div>
                <div className="ags-sub">Short ad · Instant reward</div>
              </div>
            </div>
            <div className="ags-badge">+{rewardAmount} PTS</div>
          </div>

          {state === "error" && (
            <div className="ags-status error">
              <span>✕</span> Ad unavailable
            </div>
          )}

          {state === "no_banner" && (
            <div className="ags-status nobanner">
              <span>—</span> No ads right now
            </div>
          )}

          <adsgram-task
            key={reloadKey}
            ref={taskRef}
            data-block-id={blockId}
          />
        </div>

        {state === "done" && (
          <div className="ags-done-overlay">
            <div className="ags-done-icon">✦</div>
            <div className="ags-done-label">+{rewardAmount} PTS</div>
            <div className="ags-done-sub">Points credited</div>
          </div>
        )}
      </div>
    </>
  );
}

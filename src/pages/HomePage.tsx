import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getTransactions, logAdWatch } from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import { supabase } from "@/integrations/supabase/client";

type HapticType = "impact" | "success" | "error";

interface Transaction {
  id: string;
  type: string;
  points: number;
  created_at: string;
}

function triggerHaptic(type: HapticType) {
  if (typeof window !== "undefined" && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (tg?.HapticFeedback) {
      if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
      if (type === "success") tg.HapticFeedback.notificationOccurred("success");
      if (type === "error") tg.HapticFeedback.notificationOccurred("error");
    }
  }
}

function AnimatedNumber({ value = 0 }: { value: number }) {
  const [display, setDisplay] = useState<number>(value);
  const prev = useRef<number>(value);
  useEffect(() => {
    let start = prev.current;
    const diff = value - start;
    const steps = 30;
    const inc = diff / steps;
    let step = 0;
    const timer = setInterval(() => {
      step++;
      start += inc;
      if (step >= steps) { setDisplay(value); clearInterval(timer); }
      else setDisplay(Math.floor(start));
    }, 20);
    prev.current = value;
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

function txLabel(type: string): string {
  const map: Record<string, string> = {
    tap_earn:       "Tap Earn",
    farm_claim:     "Farm Reward",
    ad_watch:       "Ad Watch",
    adsgram_reward: "Adsgram Ad",
    tower_climb:    "Tower Climb",
    lucky_box:      "Lucky Box",
    dice_roll:      "Dice Roll",
    card_flip:      "Card Flip",
    number_guess:   "Number Guess",
    daily_reward:   "Daily Reward",
    referral_bonus: "Referral Bonus",
    task_complete:  "Task Complete",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function txIcon(type: string): string {
  const map: Record<string, string> = {
    tap_earn:       "👆",
    farm_claim:     "🌾",
    ad_watch:       "🎬",
    adsgram_reward: "🎬",
    tower_climb:    "🏗️",
    lucky_box:      "🎁",
    dice_roll:      "🎲",
    card_flip:      "🃏",
    number_guess:   "🎯",
    daily_reward:   "🔥",
    referral_bonus: "👥",
    task_complete:  "✅",
  };
  return map[type] || "💰";
}

/* ── Constants ── */
const TAP_MAX_PER_HOUR = 50;
const FARM_DURATION_MS = 15 * 60 * 1000; // 15 min
const FARM_REWARD = 15;
const AD_MAX_PER_DAY = 15;
const AD_REWARD = 30;
const AD_COOLDOWN_MS = 10000; // 10 sec

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes hpBounce  { from{transform:scale(0.3) translateY(10px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
@keyframes hpShine   { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes hpMsgIn   { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpDot     { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes hpFadeIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpPulse   { 0%,100%{opacity:0.7} 50%{opacity:1} }
@keyframes hpRipple  { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
@keyframes hpTapPop  { 0%{transform:scale(1)} 40%{transform:scale(0.92)} 100%{transform:scale(1)} }
@keyframes hpGlow    { 0%,100%{box-shadow:0 0 30px rgba(255,190,0,0.3)} 50%{box-shadow:0 0 60px rgba(255,190,0,0.6)} }
@keyframes hpFarmPulse { 0%,100%{box-shadow:0 0 20px rgba(74,222,128,0.2)} 50%{box-shadow:0 0 40px rgba(74,222,128,0.5)} }
@keyframes hpSpin    { to{transform:rotate(360deg)} }
@keyframes hpFloat   { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
@keyframes hpCdFlash { 0%,100%{color:#ef4444} 50%{color:#fca5a5} }

.hp-root {
  font-family: 'Rajdhani', sans-serif;
  padding: 0 16px 112px;
  color: #fff;
  min-height: 100vh;
}

/* ── Balance ── */
.hp-balance {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 24px; padding: 20px;
  margin-bottom: 14px; text-align: center;
  position: relative; overflow: hidden;
}
.hp-balance::before {
  content:''; position:absolute; top:0; left:15%; right:15%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent);
}
.hp-balance::after {
  content:''; position:absolute; inset:0;
  background-image: linear-gradient(rgba(255,255,255,0.015) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.015) 1px,transparent 1px);
  background-size:28px 28px; pointer-events:none; border-radius:24px;
}
.hp-balance-inner { position:relative; z-index:1; }
.hp-burst { font-size:32px; animation:hpBounce 0.6s cubic-bezier(0.34,1.56,0.64,1); margin-bottom:4px; }
.hp-bal-label { font-family:'Orbitron',monospace; font-size:9px; letter-spacing:4px; color:rgba(255,255,255,0.25); text-transform:uppercase; margin-bottom:4px; }
.hp-bal-value { font-family:'Orbitron',monospace; font-size:48px; font-weight:900; line-height:1; color:#ffbe00; text-shadow:0 0 30px rgba(255,190,0,0.4); letter-spacing:2px; }
.hp-bal-sub { font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.2); text-transform:uppercase; margin-top:4px; }
.hp-bal-msg { margin-top:8px; display:inline-flex; align-items:center; gap:6px; padding:4px 14px; border-radius:20px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#4ade80; letter-spacing:1px; animation:hpMsgIn 0.3s ease; }

/* ── TAP SECTION ── */
.hp-tap-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 22px; padding: 20px 16px;
  margin-bottom: 14px; position: relative; overflow: hidden;
  animation: hpFadeIn 0.4s ease;
}
.hp-tap-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent);
}
.hp-tap-header {
  display:flex; align-items:center; justify-content:space-between; margin-bottom:16px;
}
.hp-tap-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); }
.hp-tap-info { display:flex; gap:8px; }
.hp-tap-chip { font-family:'Orbitron',monospace; font-size:8px; font-weight:600; letter-spacing:1px; padding:3px 8px; border-radius:20px; }
.hp-tap-chip.gold { background:rgba(255,190,0,0.1); border:1px solid rgba(255,190,0,0.25); color:#ffbe00; }
.hp-tap-chip.red  { background:rgba(239,68,68,0.1);  border:1px solid rgba(239,68,68,0.25);  color:#ef4444; }

/* Tap button */
.hp-tap-center { display:flex; flex-direction:column; align-items:center; gap:12px; }
.hp-tap-btn-wrap {
  position: relative; width: 140px; height: 140px;
  display:flex; align-items:center; justify-content:center;
}
.hp-tap-ripple {
  position:absolute; inset:0; border-radius:50%;
  border: 2px solid rgba(255,190,0,0.5);
  animation: hpRipple 1.2s ease-out infinite;
  pointer-events:none;
}
.hp-tap-ripple:nth-child(2) { animation-delay: 0.4s; }
.hp-tap-btn {
  width:120px; height:120px; border-radius:50%; border:none;
  background: radial-gradient(circle at 38% 35%, rgba(255,255,255,0.15), rgba(255,190,0,0.05));
  border: 2.5px solid rgba(255,190,0,0.5);
  cursor:pointer; position:relative; z-index:1;
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px;
  transition: transform 0.1s;
  animation: hpGlow 2.5s ease-in-out infinite;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.hp-tap-btn:active { animation: hpTapPop 0.15s ease; }
.hp-tap-btn-emoji { font-size: 44px; line-height:1; pointer-events:none; animation: hpFloat 3s ease-in-out infinite; }
.hp-tap-btn-pts { font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#ffbe00; letter-spacing:1px; pointer-events:none; }

/* Tap progress bar */
.hp-tap-progress-wrap { width:100%; }
.hp-tap-progress-label { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.hp-tap-progress-track { height:5px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.hp-tap-progress-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#ffbe00,#f59e0b); box-shadow:0 0 6px rgba(255,190,0,0.4); transition:width 0.3s ease; }

/* Floating +1 */
.hp-float-pts {
  position:absolute; font-family:'Orbitron',monospace; font-size:16px; font-weight:900;
  color:#ffbe00; pointer-events:none; z-index:99;
  text-shadow:0 0 10px rgba(255,190,0,0.8);
  animation: hpFloatPts 0.8s ease-out forwards;
}
@keyframes hpFloatPts {
  0%   { opacity:1; transform:translateY(0) scale(1); }
  100% { opacity:0; transform:translateY(-60px) scale(0.7); }
}

/* ── FARM SECTION ── */
.hp-farm-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(74,222,128,0.15);
  border-radius: 22px; padding: 18px 16px;
  margin-bottom: 14px; position:relative; overflow:hidden;
  animation: hpFadeIn 0.4s 0.1s ease both;
}
.hp-farm-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(74,222,128,0.4),transparent);
}
.hp-farm-card.active { animation: hpFarmPulse 2.5s ease-in-out infinite; border-color:rgba(74,222,128,0.3); }

.hp-farm-top { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.hp-farm-icon { width:46px; height:46px; border-radius:14px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
.hp-farm-info { flex:1; min-width:0; }
.hp-farm-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:3px; }
.hp-farm-sub { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-farm-sub.active { color:#4ade80; }
.hp-farm-reward { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:1px; color:#4ade80; padding:4px 10px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); border-radius:20px; flex-shrink:0; }

/* Farm progress */
.hp-farm-progress-wrap { margin-bottom:12px; }
.hp-farm-progress-label { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.hp-farm-progress-track { height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; }
.hp-farm-progress-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,#4ade80,#22d3ee); box-shadow:0 0 6px rgba(74,222,128,0.4); transition:width 0.5s ease; }

/* Farm button */
.hp-farm-btn {
  width:100%; padding:13px; border-radius:14px; border:none;
  font-family:'Orbitron',monospace; font-size:12px; font-weight:700;
  letter-spacing:2px; cursor:pointer; transition:transform 0.12s;
  position:relative; overflow:hidden;
}
.hp-farm-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-farm-btn:active { transform:scale(0.97); }
.hp-farm-btn.start { background:linear-gradient(135deg,#4ade80,#16a34a); color:#001a0a; box-shadow:0 4px 20px rgba(74,222,128,0.3); }
.hp-farm-btn.claim { background:linear-gradient(135deg,#ffbe00,#f59e0b); color:#1a0800; box-shadow:0 4px 20px rgba(255,190,0,0.3); }
.hp-farm-btn.farming { background:rgba(255,255,255,0.04); border:1px solid rgba(74,222,128,0.2); color:rgba(74,222,128,0.5); cursor:not-allowed; }
.hp-farm-btn.farming::after { display:none; }

/* ── AD SECTION ── */
.hp-ad-card {
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,190,0,0.15);
  border-radius: 22px; padding: 18px 16px;
  margin-bottom: 14px; position:relative; overflow:hidden;
  animation: hpFadeIn 0.4s 0.2s ease both;
}
.hp-ad-card::before {
  content:''; position:absolute; top:0; left:10%; right:10%; height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent);
}
.hp-ad-top { display:flex; align-items:center; gap:12px; margin-bottom:14px; }
.hp-ad-icon { width:46px; height:46px; border-radius:14px; background:rgba(255,190,0,0.1); border:1px solid rgba(255,190,0,0.25); display:flex; align-items:center; justify-content:center; font-size:22px; flex-shrink:0; }
.hp-ad-info { flex:1; min-width:0; }
.hp-ad-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:3px; }
.hp-ad-sub { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-ad-badge { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#ffbe00; padding:4px 10px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.2); border-radius:20px; flex-shrink:0; }

/* Ad progress (daily) */
.hp-ad-daily-track { height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:12px; }
.hp-ad-daily-fill  { height:100%; border-radius:2px; background:linear-gradient(90deg,#ffbe00,#f59e0b); transition:width 0.4s; }

/* Ad button */
.hp-ad-btn {
  width:100%; padding:14px; border-radius:14px; border:none;
  background:linear-gradient(135deg,#ffbe00,#f59e0b,#d97706);
  color:#1a0800; font-family:'Orbitron',monospace; font-size:13px;
  font-weight:700; letter-spacing:2px; cursor:pointer;
  transition:transform 0.12s, box-shadow 0.2s, opacity 0.2s;
  box-shadow:0 6px 24px rgba(255,190,0,0.35);
  position:relative; overflow:hidden;
}
.hp-ad-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-ad-btn:active { transform:scale(0.97); }
.hp-ad-btn:disabled { opacity:0.5; cursor:not-allowed; }
.hp-ad-btn.cooldown { background:rgba(255,255,255,0.04); border:1px solid rgba(255,190,0,0.15); color:rgba(255,190,0,0.4); box-shadow:none; }
.hp-ad-btn.cooldown::after { display:none; }
.hp-ad-btn.maxed { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.2); box-shadow:none; }
.hp-ad-btn.maxed::after { display:none; }

/* Cooldown countdown text */
.hp-cd-text { font-family:'Orbitron',monospace; font-size:11px; letter-spacing:2px; animation:hpCdFlash 1s ease-in-out infinite; }

/* ── TABS ── */
.hp-tabs { display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:4px; gap:4px; margin-bottom:14px; }
.hp-tab { flex:1; padding:9px; border-radius:10px; border:none; background:none; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.25); cursor:pointer; transition:background 0.2s,color 0.2s; }
.hp-tab.active { background:#ffbe00; color:#1a0800; box-shadow:0 2px 12px rgba(255,190,0,0.3); }

/* ── HISTORY ── */
.hp-tx-empty { text-align:center; padding:32px 0; font-family:'Orbitron',monospace; font-size:10px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; }
.hp-tx { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:12px 14px; margin-bottom:8px; }
.hp-tx-icon { width:38px; height:38px; border-radius:11px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.15); display:flex; align-items:center; justify-content:center; font-size:17px; flex-shrink:0; }
.hp-tx-body { flex:1; min-width:0; }
.hp-tx-label { font-size:13px; font-weight:600; color:rgba(255,255,255,0.8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hp-tx-sub { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1px; margin-top:1px; }
.hp-tx-pts { font-family:'Orbitron',monospace; font-size:15px; font-weight:700; color:#ffbe00; letter-spacing:0.5px; flex-shrink:0; }

/* Loading dots */
.hp-dots span { display:inline-block; width:5px; height:5px; border-radius:50%; background:#1a0800; margin:0 2px; animation:hpDot 1.2s ease-in-out infinite; }
.hp-dots span:nth-child(2){animation-delay:0.2s} .hp-dots span:nth-child(3){animation-delay:0.4s}
`;

/* ── Floating +1 component ── */
interface FloatPt { id: number; x: number; y: number; }

export default function HomePage() {
  const { user, balance, refreshBalance } = useApp();
  const [transactions, setTransactions]   = useState<Transaction[]>([]);
  const [activeTab, setActiveTab]         = useState<"earn" | "history">("earn");
  const [message, setMessage]             = useState("");
  const [coinBurst, setCoinBurst]         = useState(false);

  /* ── TAP state ── */
  const [tapCount, setTapCount]           = useState(0);      // taps this hour
  const [tapHourStart, setTapHourStart]   = useState(() => Date.now());
  const [floatPts, setFloatPts]           = useState<FloatPt[]>([]);
  const tapBtnRef = useRef<HTMLButtonElement>(null);

  /* ── FARM state ── */
  const [farmStart, setFarmStart]         = useState<number | null>(() => {
    const s = localStorage.getItem("farmStart");
    return s ? Number(s) : null;
  });
  const [farmProgress, setFarmProgress]   = useState(0); // 0–100
  const [farmReady, setFarmReady]         = useState(false);
  const [farmClaiming, setFarmClaiming]   = useState(false);
  const [farmTimeLeft, setFarmTimeLeft]   = useState("");

  /* ── AD state ── */
  const [adsToday, setAdsToday]           = useState(0);
  const [adCooldown, setAdCooldown]       = useState(0); // seconds left
  const [adLoading, setAdLoading]         = useState(false);
  const isAdRunning = useRef(false);

  /* ── load data ── */
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    loadTodayAds();
  }, [user]);

  async function loadTodayAds() {
    if (!user) return;
    const start = new Date();
    start.setUTCHours(0,0,0,0);
    const { count } = await supabase
      .from('ad_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', start.toISOString());
    setAdsToday(count || 0);
  }

  /* ── hourly tap reset ── */
  useEffect(() => {
    const now = Date.now();
    if (now - tapHourStart >= 3600000) {
      setTapCount(0);
      setTapHourStart(now);
    }
  }, []);

  /* ── Farm ticker ── */
  useEffect(() => {
    if (!farmStart) return;
    const tick = setInterval(() => {
      const elapsed = Date.now() - farmStart;
      const pct = Math.min(100, (elapsed / FARM_DURATION_MS) * 100);
      setFarmProgress(pct);
      if (elapsed >= FARM_DURATION_MS) {
        setFarmReady(true);
        setFarmProgress(100);
        setFarmTimeLeft("Ready!");
        clearInterval(tick);
      } else {
        const rem = Math.ceil((FARM_DURATION_MS - elapsed) / 1000);
        const m = Math.floor(rem / 60);
        const s = rem % 60;
        setFarmTimeLeft(`${m}:${s.toString().padStart(2,'0')}`);
      }
    }, 500);
    return () => clearInterval(tick);
  }, [farmStart]);

  /* ── Ad cooldown ticker ── */
  useEffect(() => {
    if (adCooldown <= 0) return;
    const t = setInterval(() => {
      setAdCooldown(p => Math.max(0, p - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [adCooldown]);

  /* ── show message helper ── */
  function showMsg(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  }

  /* ══════════════ TAP HANDLER ══════════════ */
  async function handleTap(e: React.MouseEvent<HTMLButtonElement>) {
    if (!user) return;

    // Reset hour if needed
    if (Date.now() - tapHourStart >= 3600000) {
      setTapCount(0);
      setTapHourStart(Date.now());
    }

    if (tapCount >= TAP_MAX_PER_HOUR) {
      showMsg("⏳ Hourly limit reached!");
      triggerHaptic("error");
      return;
    }

    triggerHaptic("impact");

    // Floating +1
    const rect = tapBtnRef.current?.getBoundingClientRect();
    const id = Date.now();
    const x = rect ? e.clientX - rect.left - 10 : 50;
    const y = rect ? e.clientY - rect.top - 20 : 20;
    setFloatPts(p => [...p, { id, x, y }]);
    setTimeout(() => setFloatPts(p => p.filter(f => f.id !== id)), 800);

    setTapCount(p => p + 1);

    // Credit balance
    const { data: bal } = await supabase
      .from('balances').select('points, total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points:       bal.points + 1,
        total_earned: bal.total_earned + 1,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'tap_earn', points: 1,
        description: '👆 Tap Earn',
      });
      refreshBalance();
    }
  }

  /* ══════════════ FARM HANDLER ══════════════ */
  function handleStartFarm() {
    if (farmStart) return;
    const now = Date.now();
    setFarmStart(now);
    setFarmProgress(0);
    setFarmReady(false);
    localStorage.setItem("farmStart", String(now));
    triggerHaptic("impact");
    showMsg("🌾 Farming started!");
  }

  async function handleClaimFarm() {
    if (!user || farmClaiming || !farmReady) return;
    triggerHaptic("success");
    setFarmClaiming(true);

    const { data: bal } = await supabase
      .from('balances').select('points, total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points:       bal.points + FARM_REWARD,
        total_earned: bal.total_earned + FARM_REWARD,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'farm_claim', points: FARM_REWARD,
        description: `🌾 Farm Reward: +${FARM_REWARD} pts`,
      });
      await refreshBalance();
    }

    setFarmStart(null);
    setFarmProgress(0);
    setFarmReady(false);
    setFarmTimeLeft("");
    setFarmClaiming(false);
    localStorage.removeItem("farmStart");
    setCoinBurst(true);
    showMsg(`+${FARM_REWARD} pts 🌾`);
    getTransactions(user.id).then(setTransactions);
    setTimeout(() => setCoinBurst(false), 1200);
  }

  /* ══════════════ AD HANDLER ══════════════ */
  const onAdReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await logAdWatch(user.id, "ad_watch", AD_REWARD);

    const { data: bal } = await supabase
      .from('balances').select('points, total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points:       bal.points + AD_REWARD,
        total_earned: bal.total_earned + AD_REWARD,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type: 'ad_watch', points: AD_REWARD,
        description: `🎬 Ad Watch: +${AD_REWARD} pts`,
      });
    }
    await refreshBalance();
    setAdsToday(p => p + 1);
    setAdCooldown(AD_COOLDOWN_MS / 1000);
    setCoinBurst(true);
    showMsg(`+${AD_REWARD} pts 🎬`);
    getTransactions(user.id).then(setTransactions);
    setTimeout(() => setCoinBurst(false), 1200);
  }, [user, refreshBalance]);

  const { showAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user || isAdRunning.current || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY) return;
    isAdRunning.current = true;
    triggerHaptic("impact");
    setAdLoading(true);
    try { await showAd(); } catch { showMsg("Ad failed. Try again."); }
    setAdLoading(false);
    isAdRunning.current = false;
  }

  const tapPct   = Math.min(100, (tapCount / TAP_MAX_PER_HOUR) * 100);
  const adPct    = Math.min(100, (adsToday / AD_MAX_PER_DAY) * 100);
  const isFarming = !!farmStart && !farmReady;

  return (
    <>
      <style>{CSS}</style>
      <div className="hp-root">

        {/* ── BALANCE ── */}
        <div className="hp-balance">
          <div className="hp-balance-inner">
            {coinBurst && <div className="hp-burst">💰</div>}
            <div className="hp-bal-label">Total Balance</div>
            <div className="hp-bal-value">
              <AnimatedNumber value={balance?.points || 0} />
            </div>
            <div className="hp-bal-sub">Available Points</div>
            {message && <div className="hp-bal-msg">✦ {message}</div>}
          </div>
        </div>

        {/* ══════════ TAP TO EARN ══════════ */}
        <div className="hp-tap-card">
          <div className="hp-tap-header">
            <div className="hp-tap-title">👆 TAP TO EARN</div>
            <div className="hp-tap-info">
              <div className="hp-tap-chip gold">+1 PT / TAP</div>
              <div className={`hp-tap-chip ${tapCount >= TAP_MAX_PER_HOUR ? 'red' : 'gold'}`}>
                {tapCount}/{TAP_MAX_PER_HOUR}/HR
              </div>
            </div>
          </div>

          <div className="hp-tap-center">
            {/* Tap button */}
            <div className="hp-tap-btn-wrap" style={{ position: 'relative' }}>
              <div className="hp-tap-ripple" />
              <div className="hp-tap-ripple" />
              <button
                ref={tapBtnRef}
                className="hp-tap-btn"
                onClick={handleTap}
                disabled={tapCount >= TAP_MAX_PER_HOUR}
                style={tapCount >= TAP_MAX_PER_HOUR ? {
                  opacity: 0.4, cursor: 'not-allowed',
                  animation: 'none', boxShadow: 'none',
                } : {}}
              >
                <span className="hp-tap-btn-emoji">🪙</span>
                <span className="hp-tap-btn-pts">TAP</span>
              </button>
              {/* Floating +1s */}
              {floatPts.map(f => (
                <div key={f.id} className="hp-float-pts"
                  style={{ left: f.x, top: f.y }}>
                  +1
                </div>
              ))}
            </div>

            {/* Progress */}
            <div className="hp-tap-progress-wrap">
              <div className="hp-tap-progress-label">
                <span>Hourly Progress</span>
                <span style={{ color: tapCount >= TAP_MAX_PER_HOUR ? '#ef4444' : '#ffbe00' }}>
                  {tapCount >= TAP_MAX_PER_HOUR ? 'LIMIT REACHED' : `${tapCount} taps`}
                </span>
              </div>
              <div className="hp-tap-progress-track">
                <div className="hp-tap-progress-fill"
                  style={{
                    width: `${tapPct}%`,
                    background: tapPct >= 100
                      ? 'linear-gradient(90deg,#ef4444,#dc2626)'
                      : 'linear-gradient(90deg,#ffbe00,#f59e0b)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ══════════ FARM ══════════ */}
        <div className={`hp-farm-card ${isFarming ? 'active' : ''}`}>
          <div className="hp-farm-top">
            <div className="hp-farm-icon">🌾</div>
            <div className="hp-farm-info">
              <div className="hp-farm-title">FARMING</div>
              <div className={`hp-farm-sub ${isFarming || farmReady ? 'active' : ''}`}>
                {farmReady
                  ? '✦ Ready to claim!'
                  : isFarming
                  ? `⏱ ${farmTimeLeft} remaining`
                  : '15 min → +15 pts'}
              </div>
            </div>
            <div className="hp-farm-reward">+{FARM_REWARD} PTS</div>
          </div>

          {/* Progress bar */}
          <div className="hp-farm-progress-wrap">
            <div className="hp-farm-progress-label">
              <span>{farmReady ? 'Complete!' : isFarming ? 'Farming...' : 'Not started'}</span>
              <span style={{ color: farmReady ? '#ffbe00' : '#4ade80' }}>
                {Math.round(farmProgress)}%
              </span>
            </div>
            <div className="hp-farm-progress-track">
              <div className="hp-farm-progress-fill"
                style={{
                  width: `${farmProgress}%`,
                  background: farmReady
                    ? 'linear-gradient(90deg,#ffbe00,#f59e0b)'
                    : 'linear-gradient(90deg,#4ade80,#22d3ee)',
                }}
              />
            </div>
          </div>

          {/* Farm button */}
          {farmReady ? (
            <button
              className="hp-farm-btn claim"
              onClick={handleClaimFarm}
              disabled={farmClaiming}
            >
              {farmClaiming ? (
                <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                  <span className="hp-dots"><span/><span/><span/></span>
                </span>
              ) : '🎁 CLAIM +15 PTS'}
            </button>
          ) : isFarming ? (
            <button className="hp-farm-btn farming" disabled>
              🌾 FARMING IN PROGRESS...
            </button>
          ) : (
            <button className="hp-farm-btn start" onClick={handleStartFarm}>
              🚀 START FARMING
            </button>
          )}
        </div>

        {/* ══════════ WATCH AD ══════════ */}
        <div className="hp-ad-card">
          <div className="hp-ad-top">
            <div className="hp-ad-icon">🎬</div>
            <div className="hp-ad-info">
              <div className="hp-ad-title">WATCH ADS</div>
              <div className="hp-ad-sub">
                {adsToday >= AD_MAX_PER_DAY
                  ? 'Daily limit reached'
                  : `${adsToday}/${AD_MAX_PER_DAY} ads today`}
              </div>
            </div>
            <div className="hp-ad-badge">+{AD_REWARD} PTS</div>
          </div>

          {/* Daily progress */}
          <div className="hp-ad-daily-track">
            <div className="hp-ad-daily-fill" style={{ width: `${adPct}%` }} />
          </div>

          <button
            className={`hp-ad-btn ${
              adsToday >= AD_MAX_PER_DAY ? 'maxed'
              : adCooldown > 0 ? 'cooldown'
              : ''
            }`}
            onClick={handleWatchAd}
            disabled={adLoading || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY}
          >
            {adLoading ? (
              <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                <span className="hp-dots"><span/><span/><span/></span>
              </span>
            ) : adsToday >= AD_MAX_PER_DAY ? (
              '✅ DAILY LIMIT REACHED'
            ) : adCooldown > 0 ? (
              <span className="hp-cd-text">⏳ NEXT AD IN {adCooldown}s</span>
            ) : (
              '🎬  WATCH AD  +30 PTS'
            )}
          </button>
        </div>

        {/* ── TABS ── */}
        <div className="hp-tabs">
          <button
            className={`hp-tab ${activeTab === "earn" ? "active" : ""}`}
            onClick={() => setActiveTab("earn")}
          >
            Earn
          </button>
          <button
            className={`hp-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </div>

        {/* ── EARN TAB ── */}
        {activeTab === "earn" && (
          <div style={{ textAlign:'center', padding:'24px 0' }}>
            <div style={{ fontFamily:"'Orbitron',monospace", fontSize:9, letterSpacing:'3px', color:'rgba(255,255,255,0.15)', textTransform:'uppercase' }}>
              ✦ Tap · Farm · Watch Ads above ✦
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {activeTab === "history" && (
          <div>
            {transactions.length === 0 ? (
              <div className="hp-tx-empty">No transactions yet</div>
            ) : (
              transactions.map(t => (
                <div key={t.id} className="hp-tx">
                  <div className="hp-tx-icon">{txIcon(t.type)}</div>
                  <div className="hp-tx-body">
                    <div className="hp-tx-label">{txLabel(t.type)}</div>
                    <div className="hp-tx-sub">Points earned</div>
                  </div>
                  <div className="hp-tx-pts">+{t.points}</div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </>
  );
}

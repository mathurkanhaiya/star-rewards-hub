import React, { useEffect, useState, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { getTransactions, logAdWatch } from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import { supabase } from "@/integrations/supabase/client";
import AdsgramTask from "@/components/AdsgramTask";

type HapticType = "impact" | "success" | "error";
interface Transaction { id: string; type: string; points: number; }
interface FloatPt { id: number; x: number; y: number; val: number; }

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
    const steps = 30; const inc = diff / steps; let step = 0;
    const timer = setInterval(() => {
      step++; start += inc;
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
    tap_earn: "Tap Earn", farm_claim: "Farm Reward", ad_watch: "Ad Watch",
    adsgram_reward: "Adsgram Ad", tower_climb: "Tower Climb", lucky_box: "Lucky Box",
    dice_roll: "Dice Roll", card_flip: "Card Flip", number_guess: "Number Guess",
    daily_reward: "Daily Reward", daily_drop: "Daily Drop",
    referral_bonus: "Referral Bonus", task_complete: "Task Complete",
  };
  return map[type] || type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function txIcon(type: string): string {
  const map: Record<string, string> = {
    tap_earn: "👆", farm_claim: "🌾", ad_watch: "🎬",
    adsgram_reward: "🎬", tower_climb: "🏗️", lucky_box: "🎁",
    dice_roll: "🎲", card_flip: "🃏", number_guess: "🎯",
    daily_reward: "🔥", daily_drop: "🎁", referral_bonus: "👥", task_complete: "✅",
  };
  return map[type] || "💰";
}

/* ── Constants ── */
const MAX_ENERGY          = 500;
const REGEN_PER_SEC       = 50 / 3600;
const X2_DURATION_SEC     = 10;
const FAST_DURATION_SEC   = 60;
const FAST_REGEN_MULT     = 2;
const FARM_DURATION_MS    = 15 * 60 * 1000;
const FARM_REWARD         = 100;
const AD_MAX_PER_DAY      = 20;
const AD_REWARD           = 50;
const AD_COOLDOWN_SEC     = 10;
const AD_INIT_DELAY_SEC   = 10;
const DROP_COOLDOWN_SEC   = 5;

const DAILY_DROP = [
  { day: 1, pts: 100, color: '#4ade80', label: 'D1' },
  { day: 2, pts: 120, color: '#4ade80', label: 'D2' },
  { day: 3, pts: 130, color: '#ffbe00', label: 'D3' },
  { day: 4, pts: 140, color: '#ffbe00', label: 'D4' },
  { day: 5, pts: 150, color: '#22d3ee', label: 'D5' },
  { day: 6, pts: 160, color: '#22d3ee', label: 'D6' },
  { day: 7, pts: 170, color: '#a78bfa', label: 'D7' },
];

function saveBoost(key: string, expiresAt: number) { localStorage.setItem(key, String(expiresAt)); }
function loadBoost(key: string): number {
  const v = localStorage.getItem(key);
  if (!v) return 0;
  return Math.max(0, Math.floor((Number(v) - Date.now()) / 1000));
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap');

@keyframes hpShine    { 0%{left:-100%} 40%,100%{left:150%} }
@keyframes hpDot      { 0%,80%,100%{transform:scale(0.5);opacity:0.4} 40%{transform:scale(1);opacity:1} }
@keyframes hpFadeIn   { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpMsgIn    { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
@keyframes hpFloat    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
@keyframes hpRipple   { 0%{transform:scale(0.9);opacity:0.5} 100%{transform:scale(2.1);opacity:0} }
@keyframes hpTapPop   { 0%{transform:scale(1)} 30%{transform:scale(0.91)} 100%{transform:scale(1)} }
@keyframes hpGoldGlow { 0%,100%{box-shadow:0 0 24px rgba(255,190,0,0.3),0 0 0 2px rgba(255,190,0,0.12)} 50%{box-shadow:0 0 44px rgba(255,190,0,0.6),0 0 0 2px rgba(255,190,0,0.28)} }
@keyframes hpX2Glow   { 0%,100%{box-shadow:0 0 14px rgba(251,191,36,0.25)} 50%{box-shadow:0 0 28px rgba(251,191,36,0.6)} }
@keyframes hpFastGlow { 0%,100%{box-shadow:0 0 14px rgba(34,211,238,0.25)} 50%{box-shadow:0 0 28px rgba(34,211,238,0.6)} }
@keyframes hpFarmPulse{ 0%,100%{border-color:rgba(74,222,128,0.2)} 50%{border-color:rgba(74,222,128,0.5)} }
@keyframes hpCdFlash  { 0%,100%{opacity:0.5} 50%{opacity:1} }
@keyframes hpFloatPts { 0%{opacity:1;transform:translateY(0) scale(1.1)} 100%{opacity:0;transform:translateY(-70px) scale(0.7)} }
@keyframes hpEPulse   { 0%,100%{opacity:0.6} 50%{opacity:1} }
@keyframes hpSpin     { to{transform:rotate(360deg)} }

.hp-root { font-family:'Rajdhani',sans-serif; padding:0 16px 112px; color:#fff; min-height:100vh; }

.hp-msg { display:flex; align-items:center; justify-content:center; gap:6px; padding:7px 16px; border-radius:13px; margin-bottom:12px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#4ade80; letter-spacing:1px; animation:hpMsgIn 0.3s ease; }

/* TAP */
.hp-tap-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,190,0,0.15); border-radius:22px; padding:16px 16px 14px; margin-bottom:12px; position:relative; overflow:hidden; animation:hpFadeIn 0.4s ease; }
.hp-tap-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.45),transparent); }
.hp-tap-card::after  { content:''; position:absolute; inset:0; background-image:linear-gradient(rgba(255,255,255,0.012) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.012) 1px,transparent 1px); background-size:28px 28px; pointer-events:none; border-radius:22px; }
.hp-tap-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; position:relative; z-index:1; }
.hp-tap-title  { font-family:'Orbitron',monospace; font-size:12px; font-weight:900; letter-spacing:2px; color:#fff; }
.hp-tap-title span { color:#ffbe00; }
.hp-energy-pill { display:flex; align-items:center; gap:4px; padding:3px 10px; border-radius:20px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.2); font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#ffbe00; }
.hp-energy-pill.regen { animation:hpEPulse 1.5s ease-in-out infinite; }
.hp-tap-center { display:flex; flex-direction:column; align-items:center; gap:12px; position:relative; z-index:1; }
.hp-tap-btn-wrap { position:relative; width:130px; height:130px; display:flex; align-items:center; justify-content:center; }
.hp-tap-ripple { position:absolute; inset:0; border-radius:50%; border:2px solid rgba(255,190,0,0.35); animation:hpRipple 1.8s ease-out infinite; pointer-events:none; }
.hp-tap-ripple:nth-child(2){animation-delay:0.6s} .hp-tap-ripple:nth-child(3){animation-delay:1.2s}
.hp-tap-btn { width:112px; height:112px; border-radius:50%; border:2.5px solid rgba(255,190,0,0.5); background:radial-gradient(circle at 38% 33%,rgba(255,255,255,0.1),rgba(255,190,0,0.04) 60%); cursor:pointer; position:relative; z-index:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:2px; animation:hpGoldGlow 2.5s ease-in-out infinite; -webkit-tap-highlight-color:transparent; user-select:none; transition:opacity 0.2s; }
.hp-tap-btn:active  { animation:hpTapPop 0.15s ease; }
.hp-tap-btn:disabled{ opacity:0.3; cursor:not-allowed; animation:none; box-shadow:none; }
.hp-tap-btn-emoji { font-size:46px; line-height:1; pointer-events:none; animation:hpFloat 3s ease-in-out infinite; }
.hp-tap-btn-sub   { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; color:rgba(255,190,0,0.7); letter-spacing:1px; pointer-events:none; }
.hp-float-pts { position:absolute; font-family:'Orbitron',monospace; font-size:17px; font-weight:900; color:#ffbe00; pointer-events:none; z-index:99; text-shadow:0 0 12px rgba(255,190,0,0.9); animation:hpFloatPts 0.9s ease-out forwards; }
.hp-energy-wrap    { width:100%; }
.hp-energy-labels  { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.hp-energy-track   { height:7px; border-radius:4px; background:rgba(255,255,255,0.06); overflow:hidden; position:relative; }
.hp-energy-fill    { height:100%; border-radius:4px; transition:width 0.5s ease; }
.hp-energy-segments{ position:absolute; inset:0; display:flex; gap:2px; padding:0 2px; pointer-events:none; }
.hp-energy-seg     { flex:1; border-right:1px solid rgba(6,8,15,0.4); }
.hp-regen-label    { text-align:center; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; margin-top:5px; animation:hpCdFlash 1.5s ease-in-out infinite; color:#ef4444; }
.hp-boost-row { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:10px; position:relative; z-index:1; }
.hp-boost-btn { padding:8px 6px; border-radius:12px; border:none; cursor:pointer; transition:transform 0.12s; text-align:center; position:relative; overflow:hidden; }
.hp-boost-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-boost-btn:active  { transform:scale(0.95); }
.hp-boost-btn:disabled{ opacity:0.4; cursor:not-allowed; }
.hp-boost-btn:disabled::after { display:none; }
.hp-boost-btn.x2    { background:rgba(251,191,36,0.08); border:1px solid rgba(251,191,36,0.25); color:#fbbf24; }
.hp-boost-btn.x2.on { animation:hpX2Glow 1.5s ease-in-out infinite; border-color:rgba(251,191,36,0.55); background:rgba(251,191,36,0.14); }
.hp-boost-btn.fast  { background:rgba(34,211,238,0.06); border:1px solid rgba(34,211,238,0.22); color:#22d3ee; }
.hp-boost-btn.fast.on{ animation:hpFastGlow 1.5s ease-in-out infinite; border-color:rgba(34,211,238,0.55); background:rgba(34,211,238,0.12); }
.hp-boost-row-inner { display:flex; align-items:center; justify-content:center; gap:5px; }
.hp-boost-icon  { font-size:16px; }
.hp-boost-label { font-family:'Orbitron',monospace; font-size:8px; font-weight:700; letter-spacing:1px; }
.hp-boost-sub   { font-size:9px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; margin-top:1px; }
.hp-boost-timer { font-family:'Orbitron',monospace; font-size:9px; font-weight:700; margin-top:2px; animation:hpCdFlash 1s ease-in-out infinite; }

/* DAILY DROP */
.hp-drop-card { background:rgba(255,255,255,0.02); border:1px solid rgba(255,190,0,0.15); border-radius:22px; padding:16px; margin-bottom:12px; position:relative; overflow:hidden; animation:hpFadeIn 0.4s 0.05s ease both; }
.hp-drop-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent); }
.hp-drop-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.hp-drop-title-row { display:flex; align-items:center; gap:8px; }
.hp-drop-title  { font-family:'Orbitron',monospace; font-size:13px; font-weight:900; letter-spacing:1.5px; color:#fff; }
.hp-drop-streak { display:flex; align-items:center; gap:4px; padding:4px 10px; border-radius:20px; background:rgba(255,190,0,0.1); border:1px solid rgba(255,190,0,0.25); font-family:'Orbitron',monospace; font-size:10px; font-weight:700; color:#ffbe00; letter-spacing:1px; }
.hp-drop-days { display:flex; gap:6px; margin-bottom:12px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; }
.hp-drop-days::-webkit-scrollbar { display:none; }
.hp-drop-day { flex:1; min-width:44px; border-radius:14px; padding:10px 4px 8px; text-align:center; border:2px solid rgba(255,255,255,0.08); background:rgba(255,255,255,0.03); transition:all 0.2s; position:relative; }
.hp-drop-day.claimed { background:rgba(74,222,128,0.1); border-color:rgba(74,222,128,0.5); }
.hp-drop-day.locked  { opacity:0.4; }
.hp-drop-day.jackpot { background:rgba(167,139,250,0.08); }
.hp-drop-pts    { font-family:'Orbitron',monospace; font-size:14px; font-weight:900; line-height:1; margin-bottom:4px; }
.hp-drop-dlabel { font-family:'Orbitron',monospace; font-size:8px; letter-spacing:1px; color:rgba(255,255,255,0.3); }
.hp-drop-day.claimed .hp-drop-dlabel { color:rgba(74,222,128,0.6); }
.hp-drop-check  { position:absolute; top:-5px; right:-5px; width:16px; height:16px; border-radius:50%; background:#4ade80; display:flex; align-items:center; justify-content:center; font-size:9px; border:2px solid #06080f; }
.hp-drop-loading{ display:flex; align-items:center; justify-content:center; height:72px; gap:8px; margin-bottom:12px; }
.hp-drop-spin   { width:18px; height:18px; border-radius:50%; border:2px solid rgba(255,190,0,0.15); border-top:2px solid #ffbe00; animation:hpSpin 0.8s linear infinite; }
.hp-drop-load-txt{ font-family:'Orbitron',monospace; font-size:9px; letter-spacing:3px; color:rgba(255,255,255,0.15); }
.hp-drop-btn { width:100%; padding:12px; border-radius:14px; border:none; font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s; position:relative; overflow:hidden; }
.hp-drop-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-drop-btn:active { transform:scale(0.97); }
.hp-drop-btn.claim    { background:linear-gradient(135deg,#4ade80,#16a34a); color:#001a0a; box-shadow:0 4px 16px rgba(74,222,128,0.3); }
.hp-drop-btn.cooldown { background:rgba(255,190,0,0.06); border:1px solid rgba(255,190,0,0.15); color:rgba(255,190,0,0.5); cursor:not-allowed; }
.hp-drop-btn.cooldown::after { display:none; }
.hp-drop-btn.claimed  { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); color:rgba(255,255,255,0.3); cursor:not-allowed; }
.hp-drop-btn.claimed::after { display:none; }

/* FARM */
.hp-farm-card { background:rgba(255,255,255,0.02); border:1px solid rgba(74,222,128,0.15); border-radius:22px; padding:16px; margin-bottom:12px; position:relative; overflow:hidden; animation:hpFadeIn 0.4s 0.1s ease both; }
.hp-farm-card::before { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(74,222,128,0.4),transparent); }
.hp-farm-card.farming { animation:hpFarmPulse 2.5s ease-in-out infinite; }
.hp-farm-top   { display:flex; align-items:center; gap:12px; margin-bottom:12px; }
.hp-farm-icon  { width:42px; height:42px; border-radius:13px; background:rgba(74,222,128,0.1); border:1px solid rgba(74,222,128,0.25); display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
.hp-farm-info  { flex:1; min-width:0; }
.hp-farm-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:2px; }
.hp-farm-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-farm-sub.live { color:#4ade80; }
.hp-farm-badge { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; color:#4ade80; padding:3px 10px; background:rgba(74,222,128,0.08); border:1px solid rgba(74,222,128,0.2); border-radius:20px; flex-shrink:0; }
.hp-farm-prog-labels { display:flex; justify-content:space-between; font-family:'Orbitron',monospace; font-size:8px; letter-spacing:2px; color:rgba(255,255,255,0.2); margin-bottom:5px; }
.hp-farm-track { height:6px; border-radius:3px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:11px; }
.hp-farm-fill  { height:100%; border-radius:3px; transition:width 0.5s ease; }
.hp-farm-btn { width:100%; padding:12px; border-radius:14px; border:none; font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s; position:relative; overflow:hidden; }
.hp-farm-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.2),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-farm-btn:active { transform:scale(0.97); }
.hp-farm-btn.start { background:linear-gradient(135deg,#4ade80,#16a34a); color:#001a0a; box-shadow:0 4px 16px rgba(74,222,128,0.3); }
.hp-farm-btn.claim { background:linear-gradient(135deg,#ffbe00,#f59e0b); color:#1a0800; box-shadow:0 4px 16px rgba(255,190,0,0.3); }
.hp-farm-btn.wait  { background:rgba(255,255,255,0.03); border:1px solid rgba(74,222,128,0.12); color:rgba(74,222,128,0.35); cursor:not-allowed; }
.hp-farm-btn.wait::after { display:none; }

/* AD CARD */
.hp-ad-card { background:rgba(255,255,255,0.02); border-radius:22px; padding:16px; margin-bottom:12px; position:relative; overflow:hidden; animation:hpFadeIn 0.4s 0.15s ease both; }
.hp-ad-card.gold   { border:1px solid rgba(255,190,0,0.15); }
.hp-ad-card.gold::before   { content:''; position:absolute; top:0; left:10%; right:10%; height:1px; background:linear-gradient(90deg,transparent,rgba(255,190,0,0.4),transparent); }
.hp-ad-top   { display:flex; align-items:center; gap:12px; margin-bottom:11px; }
.hp-ad-icon  { width:42px; height:42px; border-radius:13px; display:flex; align-items:center; justify-content:center; font-size:20px; flex-shrink:0; }
.hp-ad-info  { flex:1; min-width:0; }
.hp-ad-title { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; letter-spacing:2px; color:rgba(255,255,255,0.8); margin-bottom:2px; }
.hp-ad-sub   { font-size:12px; color:rgba(255,255,255,0.3); letter-spacing:0.5px; }
.hp-ad-badge { font-family:'Orbitron',monospace; font-size:11px; font-weight:700; padding:3px 10px; border-radius:20px; flex-shrink:0; }
.hp-ad-prog-track { height:4px; border-radius:2px; background:rgba(255,255,255,0.06); overflow:hidden; margin-bottom:11px; }
.hp-ad-prog-fill  { height:100%; border-radius:2px; transition:width 0.4s; }
.hp-ad-btn { width:100%; padding:13px; border-radius:14px; border:none; font-family:'Orbitron',monospace; font-size:12px; font-weight:700; letter-spacing:2px; cursor:pointer; transition:transform 0.12s,opacity 0.2s; position:relative; overflow:hidden; }
.hp-ad-btn::after { content:''; position:absolute; top:0; left:-100%; width:60%; height:100%; background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent); animation:hpShine 3s ease-in-out infinite; }
.hp-ad-btn:active   { transform:scale(0.97); }
.hp-ad-btn:disabled { opacity:0.5; cursor:not-allowed; }
.hp-ad-btn.gold-btn   { background:linear-gradient(135deg,#ffbe00,#f59e0b,#d97706); color:#1a0800; box-shadow:0 5px 20px rgba(255,190,0,0.3); }
.hp-ad-btn.ghost { background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.1); color:rgba(255,255,255,0.35); box-shadow:none; }
.hp-ad-btn.ghost::after { display:none; }
.hp-cd-txt { font-family:'Orbitron',monospace; font-size:11px; letter-spacing:2px; animation:hpCdFlash 1s ease-in-out infinite; }

/* Tabs */
.hp-tabs { display:flex; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:14px; padding:4px; gap:4px; margin-bottom:12px; }
.hp-tab  { flex:1; padding:8px; border-radius:10px; border:none; background:none; font-family:'Orbitron',monospace; font-size:10px; font-weight:700; letter-spacing:2px; text-transform:uppercase; color:rgba(255,255,255,0.25); cursor:pointer; transition:background 0.2s,color 0.2s; }
.hp-tab.active { background:#ffbe00; color:#1a0800; box-shadow:0 2px 12px rgba(255,190,0,0.3); }

/* History */
.hp-tx-empty { text-align:center; padding:28px 0; font-family:'Orbitron',monospace; font-size:10px; letter-spacing:3px; color:rgba(255,255,255,0.15); text-transform:uppercase; }
.hp-tx { display:flex; align-items:center; gap:12px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:14px; padding:11px 14px; margin-bottom:7px; }
.hp-tx-icon { width:36px; height:36px; border-radius:10px; background:rgba(255,190,0,0.08); border:1px solid rgba(255,190,0,0.15); display:flex; align-items:center; justify-content:center; font-size:16px; flex-shrink:0; }
.hp-tx-body { flex:1; min-width:0; }
.hp-tx-label{ font-size:13px; font-weight:600; color:rgba(255,255,255,0.8); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.hp-tx-sub  { font-size:10px; color:rgba(255,255,255,0.2); letter-spacing:1px; margin-top:1px; }
.hp-tx-pts  { font-family:'Orbitron',monospace; font-size:14px; font-weight:700; color:#ffbe00; flex-shrink:0; }
.hp-dots span { display:inline-block; width:5px; height:5px; border-radius:50%; background:currentColor; margin:0 2px; animation:hpDot 1.2s ease-in-out infinite; }
.hp-dots span:nth-child(2){animation-delay:0.2s} .hp-dots span:nth-child(3){animation-delay:0.4s}
`;

export default function HomePage() {
  const { user, balance, refreshBalance } = useApp();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [activeTab, setActiveTab]       = useState<"earn" | "history">("earn");
  const [message, setMessage]           = useState("");
  const tapBtnRef = useRef<HTMLButtonElement>(null);

  /* ── Energy ── */
  const [energy, setEnergy] = useState<number>(() => {
    const s = localStorage.getItem("energy");
    if (s !== null) {
      const saved    = parseFloat(s);
      const lastTime = Number(localStorage.getItem("lastEnergyTime") || Date.now());
      const elapsed  = (Date.now() - lastTime) / 1000;
      return Math.min(MAX_ENERGY, saved + elapsed * REGEN_PER_SEC);
    }
    return MAX_ENERGY;
  });

  /* ── Boosts ── */
  const [x2SecsLeft,   setX2SecsLeft]   = useState(() => loadBoost("boostX2Exp"));
  const [fastSecsLeft, setFastSecsLeft] = useState(() => loadBoost("boostFastExp"));
  const x2Active   = x2SecsLeft   > 0;
  const fastActive = fastSecsLeft > 0;

  /* ── Float pts ── */
  const [floatPts, setFloatPts] = useState<FloatPt[]>([]);

  /* ── Farm ── */
  const [farmStart, setFarmStart]       = useState<number | null>(() => {
    const s = localStorage.getItem("farmStart");
    return s ? Number(s) : null;
  });
  const [farmProgress, setFarmProgress] = useState(0);
  const [farmReady, setFarmReady]       = useState(false);
  const [farmTimeLeft, setFarmTimeLeft] = useState("");
  const [farmClaiming, setFarmClaiming] = useState(false);

  /* ── Daily Drop ── */
  const [dropStreak, setDropStreak]               = useState(0);
  const [dropClaimedToday, setDropClaimedToday]   = useState(false);
  const [dropClaiming, setDropClaiming]           = useState(false);
  const [dropLoading, setDropLoading]             = useState(true);
  const [dropCooldown, setDropCooldown]           = useState(DROP_COOLDOWN_SEC);
  const dropClaimingRef = useRef(false);

  /* ── Main Ads ── */
  const [adsToday, setAdsToday]     = useState(0);
  const [adCooldown, setAdCooldown] = useState(AD_INIT_DELAY_SEC);
  const [adLoading, setAdLoading]   = useState(false);
  const isAdRunning = useRef(false);

  /* ── Load ── */
  useEffect(() => {
    if (!user) return;
    getTransactions(user.id).then(setTransactions);
    loadTodayAds();
    loadDropState();
  }, [user]);

  async function loadTodayAds() {
    if (!user) return;
    const start = new Date(); start.setUTCHours(0,0,0,0);
    const { count } = await supabase.from('ad_logs').select('id', { count:'exact', head:true })
      .eq('user_id', user.id).eq('ad_type', 'ad_watch').gte('created_at', start.toISOString());
    setAdsToday(count || 0);
  }

  async function loadDropState() {
    if (!user) return;
    setDropLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: todayClaim } = await supabase
        .from('daily_claims').select('id')
        .eq('user_id', user.id).eq('claim_date', today).maybeSingle();
      const claimedToday = !!todayClaim;
      setDropClaimedToday(claimedToday);

      const { data: claims } = await supabase
        .from('daily_claims').select('claim_date')
        .eq('user_id', user.id)
        .order('claim_date', { ascending: false })
        .limit(8);

      if (!claims || claims.length === 0) {
        setDropStreak(0);
        return;
      }

      let streak = 0;
      const now = new Date(); now.setUTCHours(0,0,0,0);
      const startOffset = claimedToday ? 0 : 1;
      for (let i = 0; i < claims.length; i++) {
        const claimDate = new Date(claims[i].claim_date);
        const expected  = new Date(now);
        expected.setUTCDate(now.getUTCDate() - (i + startOffset));
        if (claimDate.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) streak++;
        else break;
      }
      setDropStreak(streak);
    } finally {
      setDropLoading(false);
    }
  }

  useEffect(() => {
    if (dropCooldown <= 0) return;
    const t = setInterval(() => setDropCooldown(p => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [dropCooldown]);

  useEffect(() => {
    const t = setInterval(() => {
      setEnergy(prev => {
        if (prev >= MAX_ENERGY) return MAX_ENERGY;
        const mult = fastActive ? FAST_REGEN_MULT : 1;
        const next = Math.min(MAX_ENERGY, prev + REGEN_PER_SEC * mult);
        localStorage.setItem("energy", String(next));
        localStorage.setItem("lastEnergyTime", String(Date.now()));
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [fastActive]);

  useEffect(() => {
    const t = setInterval(() => {
      setX2SecsLeft(p => { const n = Math.max(0,p-1); if(!n) localStorage.removeItem("boostX2Exp"); return n; });
      setFastSecsLeft(p => { const n = Math.max(0,p-1); if(!n) localStorage.removeItem("boostFastExp"); return n; });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setAdCooldown(p => Math.max(0, p - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!farmStart) return;
    const t = setInterval(() => {
      const elapsed = Date.now() - farmStart;
      const pct = Math.min(100, (elapsed / FARM_DURATION_MS) * 100);
      setFarmProgress(pct);
      if (elapsed >= FARM_DURATION_MS) {
        setFarmReady(true); setFarmProgress(100); setFarmTimeLeft("Ready!"); clearInterval(t);
      } else {
        const rem = Math.ceil((FARM_DURATION_MS - elapsed) / 1000);
        setFarmTimeLeft(`${Math.floor(rem/60)}:${(rem%60).toString().padStart(2,'0')}`);
      }
    }, 500);
    return () => clearInterval(t);
  }, [farmStart]);

  function showMsg(text: string) {
    setMessage(text); setTimeout(() => setMessage(""), 2500);
  }
  function fmtBoost(s: number) {
    return s >= 60 ? `${Math.floor(s/60)}:${(s%60).toString().padStart(2,'0')}` : `${s}s`;
  }

  async function creditBalance(pts: number, type: string, desc: string) {
    if (!user) return;
    const { data: bal } = await supabase
      .from('balances').select('points,total_earned').eq('user_id', user.id).single();
    if (bal) {
      await supabase.from('balances').update({
        points: bal.points + pts, total_earned: bal.total_earned + pts,
      }).eq('user_id', user.id);
      await supabase.from('transactions').insert({
        user_id: user.id, type, points: pts, description: desc,
      });
    }
    refreshBalance();
  }

  async function handleTap(e: React.MouseEvent<HTMLButtonElement>) {
    if (!user || energy < 1) return;
    triggerHaptic("impact");
    const pts = x2Active ? 2 : 1;
    const newEnergy = Math.max(0, energy - 1);
    setEnergy(newEnergy);
    localStorage.setItem("energy", String(newEnergy));
    localStorage.setItem("lastEnergyTime", String(Date.now()));

    const rect = tapBtnRef.current?.getBoundingClientRect();
    const id = Date.now() + Math.random();
    const x = rect ? e.clientX - rect.left - 14 : 50;
    const y = rect ? e.clientY - rect.top - 30 : 20;
    setFloatPts(p => [...p, { id, x, y, val: pts }]);
    setTimeout(() => setFloatPts(p => p.filter(f => f.id !== id)), 900);

    await creditBalance(pts, 'tap_earn', `👆 Tap${x2Active ? ' (2x)' : ''}`);
  }

  const onX2Reward = useCallback(() => {
    const exp = Date.now() + X2_DURATION_SEC * 1000;
    saveBoost("boostX2Exp", exp);
    setX2SecsLeft(X2_DURATION_SEC);
    triggerHaptic("success"); showMsg("⚡ 2x active for 10s!");
  }, []);
  const { showAd: showX2Ad } = useRewardedAd(onX2Reward);

  const onFastReward = useCallback(() => {
    const exp = Date.now() + FAST_DURATION_SEC * 1000;
    saveBoost("boostFastExp", exp);
    setFastSecsLeft(FAST_DURATION_SEC);
    triggerHaptic("success"); showMsg("🔋 Fast charge for 1 min!");
  }, []);
  const { showAd: showFastAd } = useRewardedAd(onFastReward);

  async function handleClaimDrop() {
    if (!user || dropClaimedToday || dropClaiming || dropLoading || dropCooldown > 0) return;
    if (dropClaimingRef.current) return;
    dropClaimingRef.current = true;
    triggerHaptic("success"); setDropClaiming(true);

    try {
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('daily_claims').select('id')
        .eq('user_id', user.id).eq('claim_date', today).maybeSingle();
      if (existing) {
        setDropClaimedToday(true);
        setDropClaiming(false);
        dropClaimingRef.current = false;
        return;
      }

      const dayIndex = Math.min(dropStreak, 6);
      const reward   = DAILY_DROP[dayIndex].pts;

      const { error: claimError } = await supabase.from('daily_claims').insert({
        user_id: user.id, claim_date: today, claimed_at: new Date().toISOString(),
      });
      if (claimError) {
        setDropClaimedToday(true);
        setDropClaiming(false);
        dropClaimingRef.current = false;
        return;
      }

      await creditBalance(reward, 'daily_drop', `🎁 Daily Drop Day ${dayIndex+1}: +${reward} pts`);

      setDropClaimedToday(true);
      setDropStreak(p => p + 1);
      showMsg(`+${reward} pts 🎁 Day ${dayIndex+1}!`);
      getTransactions(user.id).then(setTransactions);
    } catch {
      showMsg("Error claiming. Try again.");
    } finally {
      setDropClaiming(false);
      dropClaimingRef.current = false;
    }
  }

  const onFarmStartReward = useCallback(() => {
    const now = Date.now();
    setFarmStart(now); setFarmProgress(0); setFarmReady(false);
    localStorage.setItem("farmStart", String(now));
    triggerHaptic("impact"); showMsg("🌾 Farming started!");
  }, []);
  const { showAd: showFarmStartAd } = useRewardedAd(onFarmStartReward);

  const onFarmClaimReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await creditBalance(FARM_REWARD, 'farm_claim', `🌾 Farm: +${FARM_REWARD} pts`);
    setFarmStart(null); setFarmProgress(0); setFarmReady(false); setFarmTimeLeft("");
    localStorage.removeItem("farmStart");
    showMsg(`+${FARM_REWARD} pts 🌾`);
    getTransactions(user.id).then(setTransactions);
  }, [user, refreshBalance]);
  const { showAd: showFarmClaimAd } = useRewardedAd(onFarmClaimReward);

  async function handleFarmStart() {
    if (farmStart) return;
    setFarmClaiming(true);
    try { await showFarmStartAd(); } catch { showMsg("Ad failed."); }
    setFarmClaiming(false);
  }
  async function handleFarmClaim() {
    if (!farmReady || farmClaiming) return;
    setFarmClaiming(true);
    try { await showFarmClaimAd(); } catch { showMsg("Ad failed."); }
    setFarmClaiming(false);
  }

  const onAdReward = useCallback(async () => {
    if (!user) return;
    triggerHaptic("success");
    await logAdWatch(user.id, "ad_watch", AD_REWARD);
    await creditBalance(AD_REWARD, 'ad_watch', `🎬 Ad Watch: +${AD_REWARD} pts`);
    setAdsToday(p => p + 1);
    setAdCooldown(AD_COOLDOWN_SEC);
    showMsg(`+${AD_REWARD} pts 🎬`);
    getTransactions(user.id).then(setTransactions);
  }, [user, refreshBalance]);
  const { showAd: showMainAd } = useRewardedAd(onAdReward);

  async function handleWatchAd() {
    if (!user || isAdRunning.current || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY) return;
    isAdRunning.current = true;
    triggerHaptic("impact"); setAdLoading(true);
    try { await showMainAd(); } catch { showMsg("Ad failed."); }
    setAdLoading(false); isAdRunning.current = false;
  }

  const energyPct   = (energy / MAX_ENERGY) * 100;
  const energyColor = energyPct > 50 ? '#ffbe00' : energyPct > 20 ? '#f97316' : '#ef4444';
  const isFarming   = !!farmStart && !farmReady;
  const todayDayIdx = Math.min(dropStreak - (dropClaimedToday ? 1 : 0), 6);
  const dropBtnDisabled = dropClaimedToday || dropClaiming || dropLoading || dropCooldown > 0;
  const dropBtnClass    = dropClaimedToday ? 'claimed' : (dropCooldown > 0 || dropLoading) ? 'cooldown' : 'claim';

  return (
    <>
      <style>{CSS}</style>
      <div className="hp-root">

        {message && <div className="hp-msg">✦ {message}</div>}

        {/* TAP TO EARN */}
        <div className="hp-tap-card">
          <div className="hp-tap-header">
            <div className="hp-tap-title">⚡ TAP <span>TO EARN</span></div>
            <div className={`hp-energy-pill ${energy < MAX_ENERGY ? 'regen' : ''}`}>
              ⚡ {Math.floor(energy)}/{MAX_ENERGY}
            </div>
          </div>
          <div className="hp-tap-center">
            <div className="hp-tap-btn-wrap">
              <div className="hp-tap-ripple"/><div className="hp-tap-ripple"/><div className="hp-tap-ripple"/>
              <button ref={tapBtnRef} className="hp-tap-btn" onClick={handleTap} disabled={energy < 1}>
                <span className="hp-tap-btn-emoji">🪙</span>
                <span className="hp-tap-btn-sub">{x2Active ? '+2 PTS' : '+1 PT'}</span>
              </button>
              {floatPts.map(f => (
                <div key={f.id} className="hp-float-pts" style={{ left: f.x, top: f.y }}>+{f.val}</div>
              ))}
            </div>
            <div className="hp-energy-wrap">
              <div className="hp-energy-labels">
                <span>ENERGY</span>
                <span style={{ color: energyColor }}>
                  {energy >= MAX_ENERGY ? '⚡ FULL' : fastActive ? '⚡ FAST ×2' : `+${(REGEN_PER_SEC * 60).toFixed(1)}/min`}
                </span>
              </div>
              <div className="hp-energy-track">
                <div className="hp-energy-fill" style={{
                  width:`${energyPct}%`,
                  background:`linear-gradient(90deg,${energyColor}80,${energyColor})`,
                  boxShadow:`0 0 7px ${energyColor}50`,
                }}/>
                <div className="hp-energy-segments">
                  {Array.from({length:9}).map((_,i) => <div key={i} className="hp-energy-seg"/>)}
                </div>
              </div>
              {energy < 1 && <div className="hp-regen-label">⏳ Recharging...</div>}
            </div>
          </div>
          <div className="hp-boost-row">
            <button className={`hp-boost-btn x2 ${x2Active ? 'on' : ''}`}
              onClick={() => { if (!x2Active) showX2Ad(); }} disabled={x2Active}>
              <div className="hp-boost-row-inner">
                <span className="hp-boost-icon">⚡</span>
                <span className="hp-boost-label">2× TAP</span>
              </div>
              {x2Active
                ? <div className="hp-boost-timer" style={{color:'#fbbf24'}}>{fmtBoost(x2SecsLeft)}</div>
                : <div className="hp-boost-sub">Watch ad • 10s</div>}
            </button>
            <button className={`hp-boost-btn fast ${fastActive ? 'on' : ''}`}
              onClick={() => { if (!fastActive) showFastAd(); }} disabled={fastActive}>
              <div className="hp-boost-row-inner">
                <span className="hp-boost-icon">🔋</span>
                <span className="hp-boost-label">FAST ×2</span>
              </div>
              {fastActive
                ? <div className="hp-boost-timer" style={{color:'#22d3ee'}}>{fmtBoost(fastSecsLeft)}</div>
                : <div className="hp-boost-sub">Watch ad • 1min</div>}
            </button>
          </div>
        </div>

        {/* DAILY DROP */}
        <div className="hp-drop-card">
          <div className="hp-drop-header">
            <div className="hp-drop-title-row">
              <span style={{fontSize:18}}>🎁</span>
              <span className="hp-drop-title">Daily Drop</span>
            </div>
            <div className="hp-drop-streak">
              🔥 {dropStreak > 0 ? `${Math.min(dropStreak, 7)} Day${dropStreak > 1 ? 's' : ''}` : 'New'}
            </div>
          </div>

          {dropLoading ? (
            <div className="hp-drop-loading">
              <div className="hp-drop-spin"/>
              <div className="hp-drop-load-txt">Loading...</div>
            </div>
          ) : (
            <div className="hp-drop-days">
              {DAILY_DROP.map((d, i) => {
                const claimed   = i < todayDayIdx || (i === todayDayIdx && dropClaimedToday);
                const current   = i === todayDayIdx && !dropClaimedToday;
                const locked    = i > todayDayIdx;
                const isJackpot = i === 6;
                return (
                  <div key={d.day}
                    className={`hp-drop-day ${claimed?'claimed':''} ${locked?'locked':''} ${isJackpot?'jackpot':''}`}
                    style={current ? { borderColor: d.color, boxShadow:`0 0 12px ${d.color}30` }
                      : isJackpot && !locked ? { borderColor:'#a78bfa50' } : {}}
                  >
                    {claimed && <div className="hp-drop-check">✓</div>}
                    <div className="hp-drop-pts" style={{
                      color: claimed ? '#4ade80' : locked ? 'rgba(255,255,255,0.25)' : d.color
                    }}>{d.pts}</div>
                    <div className="hp-drop-dlabel">{d.label}</div>
                  </div>
                );
              })}
            </div>
          )}

          <button className={`hp-drop-btn ${dropBtnClass}`}
            onClick={handleClaimDrop} disabled={dropBtnDisabled}>
            {dropClaiming ? (
              <span className="hp-dots" style={{color:'#001a0a'}}><span/><span/><span/></span>
            ) : dropClaimedToday ? (
              '✅  Claimed Today!'
            ) : dropLoading || dropCooldown > 0 ? (
              <span className="hp-cd-txt">⏳ {dropLoading ? 'Loading...' : `Available in ${dropCooldown}s`}</span>
            ) : (
              `🎁  CLAIM +${DAILY_DROP[todayDayIdx]?.pts || 100} PTS`
            )}
          </button>
        </div>

        {/* FARM */}
        <div className={`hp-farm-card ${isFarming ? 'farming' : ''}`}>
          <div className="hp-farm-top">
            <div className="hp-farm-icon">🌾</div>
            <div className="hp-farm-info">
              <div className="hp-farm-title">FARMING</div>
              <div className={`hp-farm-sub ${isFarming || farmReady ? 'live' : ''}`}>
                {farmReady ? '✦ Ready to claim!'
                  : isFarming ? `⏱ ${farmTimeLeft} remaining`
                  : 'Start Farming → 15 min → +100 pts'}
              </div>
            </div>
            <div className="hp-farm-badge">+{FARM_REWARD} PTS</div>
          </div>
          <div className="hp-farm-prog-labels">
            <span>{farmReady ? 'Complete!' : isFarming ? 'Farming...' : 'Idle'}</span>
            <span style={{color: farmReady ? '#ffbe00' : '#4ade80'}}>{Math.round(farmProgress)}%</span>
          </div>
          <div className="hp-farm-track">
            <div className="hp-farm-fill" style={{
              width:`${farmProgress}%`,
              background: farmReady ? 'linear-gradient(90deg,#ffbe00,#f59e0b)' : 'linear-gradient(90deg,#4ade80,#22d3ee)',
              boxShadow: isFarming ? '0 0 6px rgba(74,222,128,0.4)' : 'none',
            }}/>
          </div>
          {farmReady ? (
            <button className="hp-farm-btn claim" onClick={handleFarmClaim} disabled={farmClaiming}>
              {farmClaiming ? <span className="hp-dots" style={{color:'#1a0800'}}><span/><span/><span/></span> : '🚜 CLAIM NOW'}
            </button>
          ) : isFarming ? (
            <button className="hp-farm-btn wait" disabled>🌾 FARMING... {farmTimeLeft}</button>
          ) : (
            <button className="hp-farm-btn start" onClick={handleFarmStart} disabled={farmClaiming}>
              {farmClaiming ? <span className="hp-dots" style={{color:'#001a0a'}}><span/><span/><span/></span> : '🌾 START FARMING'}
            </button>
          )}
        </div>

        {/* WATCH ADS (Adsgram) */}
        <div className="hp-ad-card gold">
          <div className="hp-ad-top">
            <div className="hp-ad-icon" style={{background:'rgba(255,190,0,0.1)',border:'1px solid rgba(255,190,0,0.25)'}}>🎬</div>
            <div className="hp-ad-info">
              <div className="hp-ad-title">WATCH ADS</div>
              <div className="hp-ad-sub">
                {adsToday >= AD_MAX_PER_DAY ? '✅ Daily limit reached' : `${adsToday} / ${AD_MAX_PER_DAY} today`}
              </div>
            </div>
            <div className="hp-ad-badge" style={{color:'#ffbe00',background:'rgba(255,190,0,0.08)',border:'1px solid rgba(255,190,0,0.2)'}}>
              +100 PTS
            </div>
          </div>
          <div className="hp-ad-prog-track">
            <div className="hp-ad-prog-fill" style={{width:`${(adsToday/AD_MAX_PER_DAY)*100}%`,background:'linear-gradient(90deg,#ffbe00,#f59e0b)'}}/>
          </div>
          <button
            className={`hp-ad-btn ${adsToday >= AD_MAX_PER_DAY || adCooldown > 0 ? 'ghost' : 'gold-btn'}`}
            onClick={handleWatchAd}
            disabled={adLoading || adCooldown > 0 || adsToday >= AD_MAX_PER_DAY}
          >
            {adLoading ? (
              <span className="hp-dots" style={{color:'#1a0800'}}><span/><span/><span/></span>
            ) : adsToday >= AD_MAX_PER_DAY ? (
              '✅ COME BACK TOMORROW'
            ) : adCooldown > 0 ? (
              <span className="hp-cd-txt">⏳ {adCooldown <= AD_INIT_DELAY_SEC && adsToday === 0 ? `READY IN ${adCooldown}s` : `NEXT AD IN ${adCooldown}s`}</span>
            ) : (
              '🎬  WATCH AD  +100 PTS'
            )}
          </button>
        </div>

        {/* TABS */}
        <div className="hp-tabs">
          <button className={`hp-tab ${activeTab==="earn"?"active":""}`} onClick={()=>setActiveTab("earn")}>Earn</button>
          <button className={`hp-tab ${activeTab==="history"?"active":""}`} onClick={()=>setActiveTab("history")}>History</button>
        </div>

        {/* EARN TAB — only AdsgramTask (Gigapub + Monetag removed) */}
        {activeTab === "earn" && (
          <div>
            <div style={{textAlign:'center',padding:'14px 0 12px',fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:'3px',color:'rgba(255,255,255,0.1)',textTransform:'uppercase'}}>
              ✦ More Ways to Earn ✦
            </div>

            <AdsgramTask blockId="task-25198" />
          </div>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div>
            {transactions.length === 0
              ? <div className="hp-tx-empty">No transactions yet</div>
              : transactions.map(t => (
                <div key={t.id} className="hp-tx">
                  <div className="hp-tx-icon">{txIcon(t.type)}</div>
                  <div className="hp-tx-body">
                    <div className="hp-tx-label">{txLabel(t.type)}</div>
                    <div className="hp-tx-sub">Points earned</div>
                  </div>
                  <div className="hp-tx-pts">+{t.points}</div>
                </div>
              ))}
          </div>
        )}

      </div>
    </>
  );
}
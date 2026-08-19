import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { usePreferences } from "@/context/PreferencesContext";
import { claimHomeReward, getSettings, getTransactions, logAdWatch } from "@/lib/api";
import { useRewardedAd } from "@/hooks/useAdsgram";
import { supabase } from "@/integrations/supabase/client";
import AdsgramTask from "@/components/AdsgramTask";

type HapticType = "impact" | "success" | "error";
interface Transaction { id: string; type: string; points: number; }
interface FloatPt { id: number; x: number; y: number; val: number; }

function triggerHaptic(type: HapticType) {
  const tg = (window as any).Telegram?.WebApp;
  if (!tg?.HapticFeedback) return;
  if (type === "impact") tg.HapticFeedback.impactOccurred("medium");
  else tg.HapticFeedback.notificationOccurred(type);
}
function txLabel(type: string) {
  const map: Record<string,string> = { tap_earn:"Tap Earn",farm_claim:"Farm Reward",ad_watch:"Ad Watch",adsgram_reward:"Adsgram Ad",tower_climb:"Tower Climb",lucky_box:"Lucky Box",dice_roll:"Dice Roll",card_flip:"Card Flip",number_guess:"Number Guess",daily_reward:"Daily Reward",daily_drop:"Daily Drop",referral_bonus:"Referral Bonus",task_complete:"Task Complete" };
  return map[type] || type.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase());
}
function txIcon(type:string){
  const map:Record<string,string>={tap_earn:"👆",farm_claim:"🌾",ad_watch:"🎬",adsgram_reward:"🎬",tower_climb:"🏗️",lucky_box:"🎁",dice_roll:"🎲",card_flip:"🃏",number_guess:"🎯",daily_reward:"🔥",daily_drop:"🎁",referral_bonus:"👥",task_complete:"✅"};
  return map[type]||"💰";
}
function saveBoost(key:string,expiresAt:number){localStorage.setItem(key,String(expiresAt));}
function loadBoost(key:string){const v=localStorage.getItem(key);return v?Math.max(0,Math.floor((Number(v)-Date.now())/1000)):0;}

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Rajdhani:wght@500;600;700&display=swap');
@keyframes hpShine{0%{left:-100%}40%,100%{left:150%}}@keyframes hpDot{0%,80%,100%{transform:scale(.5);opacity:.4}40%{transform:scale(1);opacity:1}}@keyframes hpFadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes hpMsgIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}@keyframes hpRipple{0%{transform:scale(.9);opacity:.5}100%{transform:scale(2.1);opacity:0}}@keyframes hpGoldGlow{0%,100%{box-shadow:0 0 24px rgba(255,190,0,.3),0 0 0 2px rgba(255,190,0,.12)}50%{box-shadow:0 0 44px rgba(255,190,0,.6),0 0 0 2px rgba(255,190,0,.28)}}@keyframes hpCdFlash{0%,100%{opacity:.5}50%{opacity:1}}@keyframes hpFloatPts{0%{opacity:1;transform:translateY(0) scale(1.1)}100%{opacity:0;transform:translateY(-70px) scale(.7)}}@keyframes hpSpin{to{transform:rotate(360deg)}}
.hp-root{font-family:'Rajdhani',sans-serif;padding:0 16px 112px;color:#fff;min-height:100vh}.hp-msg{display:flex;align-items:center;justify-content:center;gap:6px;padding:7px 16px;border-radius:13px;margin-bottom:12px;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2);font-family:'Orbitron',monospace;font-size:10px;font-weight:700;color:#4ade80;letter-spacing:1px;animation:hpMsgIn .3s ease}
.hp-tap-card,.hp-drop-card,.hp-farm-card,.hp-ad-card{background:rgba(255,255,255,.02);border-radius:22px;padding:16px;margin-bottom:12px;position:relative;overflow:hidden;animation:hpFadeIn .4s ease}.hp-tap-card,.hp-drop-card,.hp-ad-card{border:1px solid rgba(255,190,0,.15)}.hp-farm-card{border:1px solid rgba(74,222,128,.15)}.hp-tap-card:before,.hp-drop-card:before,.hp-ad-card:before,.hp-farm-card:before{content:'';position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,rgba(255,190,0,.42),transparent)}.hp-farm-card:before{background:linear-gradient(90deg,transparent,rgba(74,222,128,.42),transparent)}
.hp-tap-header,.hp-drop-header,.hp-farm-top,.hp-ad-top{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.hp-tap-title,.hp-drop-title,.hp-farm-title,.hp-ad-title{font-family:'Orbitron',monospace;font-size:12px;font-weight:900;letter-spacing:2px}.hp-tap-title span{color:#ffbe00}.hp-energy-pill,.hp-drop-streak,.hp-farm-badge,.hp-ad-badge{padding:4px 10px;border-radius:20px;font-family:'Orbitron',monospace;font-size:10px;font-weight:700}.hp-energy-pill,.hp-drop-streak,.hp-ad-badge{color:#ffbe00;background:rgba(255,190,0,.08);border:1px solid rgba(255,190,0,.22)}.hp-farm-badge{color:#4ade80;background:rgba(74,222,128,.08);border:1px solid rgba(74,222,128,.2)}
.hp-tap-center{display:flex;flex-direction:column;align-items:center;gap:12px}.hp-tap-btn-wrap{position:relative;width:130px;height:130px;display:flex;align-items:center;justify-content:center}.hp-tap-ripple{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,190,0,.35);animation:hpRipple 1.8s ease-out infinite}.hp-tap-ripple:nth-child(2){animation-delay:.6s}.hp-tap-ripple:nth-child(3){animation-delay:1.2s}.hp-tap-btn{width:112px;height:112px;border-radius:50%;border:2.5px solid rgba(255,190,0,.5);background:radial-gradient(circle at 38% 33%,rgba(255,255,255,.1),rgba(255,190,0,.04) 60%);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;animation:hpGoldGlow 2.5s ease-in-out infinite;color:#ffbe00}.hp-tap-btn:disabled{opacity:.3;animation:none}.hp-tap-btn-emoji{font-size:46px}.hp-tap-btn-sub{font-family:'Orbitron',monospace;font-size:9px;font-weight:700;letter-spacing:1px}.hp-float-pts{position:absolute;font-family:'Orbitron',monospace;font-size:17px;font-weight:900;color:#ffbe00;pointer-events:none;z-index:99;text-shadow:0 0 12px rgba(255,190,0,.9);animation:hpFloatPts .9s ease-out forwards}
.hp-energy-wrap{width:100%}.hp-energy-labels,.hp-farm-prog-labels{display:flex;justify-content:space-between;font-family:'Orbitron',monospace;font-size:8px;letter-spacing:2px;color:rgba(255,255,255,.25);margin-bottom:5px}.hp-energy-track{height:7px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden}.hp-energy-fill{height:100%;border-radius:4px;transition:width .5s}.hp-regen-label{text-align:center;font-family:'Orbitron',monospace;font-size:8px;letter-spacing:2px;margin-top:5px;color:#ef4444}.hp-boost-row{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:10px}.hp-boost-btn{padding:9px 6px;border-radius:12px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);color:#fff}.hp-boost-btn.x2{color:#fbbf24;border-color:rgba(251,191,36,.25)}.hp-boost-btn.fast{color:#22d3ee;border-color:rgba(34,211,238,.22)}.hp-boost-label{font-family:'Orbitron',monospace;font-size:8px;font-weight:700;letter-spacing:1px}.hp-boost-sub{font-size:9px;color:rgba(255,255,255,.35);margin-top:2px}.hp-boost-timer{font-family:'Orbitron',monospace;font-size:9px;font-weight:700;margin-top:2px}
.hp-drop-title-row{display:flex;align-items:center;gap:8px}.hp-drop-days{display:flex;gap:6px;margin-bottom:12px;overflow-x:auto;scrollbar-width:none}.hp-drop-days::-webkit-scrollbar{display:none}.hp-drop-day{flex:1;min-width:44px;border-radius:14px;padding:10px 4px 8px;text-align:center;border:2px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);position:relative}.hp-drop-day.claimed{background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.5)}.hp-drop-day.locked{opacity:.4}.hp-drop-pts{font-family:'Orbitron',monospace;font-size:14px;font-weight:900}.hp-drop-dlabel{font-family:'Orbitron',monospace;font-size:8px;color:rgba(255,255,255,.3)}.hp-drop-check{position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;background:#4ade80;color:#001a0a;display:flex;align-items:center;justify-content:center;font-size:9px}.hp-drop-loading{display:flex;align-items:center;justify-content:center;height:72px;gap:8px}.hp-drop-spin{width:18px;height:18px;border-radius:50%;border:2px solid rgba(255,190,0,.15);border-top-color:#ffbe00;animation:hpSpin .8s linear infinite}
.hp-drop-btn,.hp-farm-btn,.hp-ad-btn{width:100%;padding:12px;border-radius:14px;border:none;font-family:'Orbitron',monospace;font-size:12px;font-weight:700;letter-spacing:2px}.hp-drop-btn.claim,.hp-farm-btn.start{background:linear-gradient(135deg,#4ade80,#16a34a);color:#001a0a}.hp-drop-btn.claimed,.hp-drop-btn.cooldown,.hp-farm-btn.wait,.hp-ad-btn.ghost{background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.35)}.hp-farm-btn.claim,.hp-ad-btn.gold-btn{background:linear-gradient(135deg,#ffbe00,#f59e0b,#d97706);color:#1a0800}.hp-farm-icon,.hp-ad-icon{width:42px;height:42px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;background:rgba(255,255,255,.04)}.hp-farm-info,.hp-ad-info{flex:1}.hp-farm-sub,.hp-ad-sub{font-size:12px;color:rgba(255,255,255,.35)}.hp-farm-sub.live{color:#4ade80}.hp-farm-track,.hp-ad-prog-track{height:6px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:11px}.hp-farm-fill,.hp-ad-prog-fill{height:100%;border-radius:3px;transition:width .4s}
.hp-tabs{display:flex;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:14px;padding:4px;gap:4px;margin-bottom:12px}.hp-tab{flex:1;padding:8px;border-radius:10px;border:none;background:none;font-family:'Orbitron',monospace;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.25)}.hp-tab.active{background:#ffbe00;color:#1a0800}.hp-tx-empty{text-align:center;padding:28px 0;font-family:'Orbitron',monospace;font-size:10px;letter-spacing:3px;color:rgba(255,255,255,.15)}.hp-tx{display:flex;align-items:center;gap:12px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:14px;padding:11px 14px;margin-bottom:7px}.hp-tx-icon{width:36px;height:36px;border-radius:10px;background:rgba(255,190,0,.08);display:flex;align-items:center;justify-content:center}.hp-tx-body{flex:1}.hp-tx-label{font-size:13px;font-weight:600}.hp-tx-sub{font-size:10px;color:rgba(255,255,255,.25)}.hp-tx-pts{font-family:'Orbitron',monospace;font-size:14px;font-weight:700;color:#ffbe00}.hp-dots span{display:inline-block;width:5px;height:5px;border-radius:50%;background:currentColor;margin:0 2px;animation:hpDot 1.2s ease-in-out infinite}.hp-dots span:nth-child(2){animation-delay:.2s}.hp-dots span:nth-child(3){animation-delay:.4s}
`;

export default function HomePage(){
  const {user,refreshBalance}=useApp();
  const {t}=usePreferences();
  const [settings,setSettings]=useState<Record<string,string>>({});
  const [transactions,setTransactions]=useState<Transaction[]>([]);
  const [activeTab,setActiveTab]=useState<"earn"|"history">("earn");
  const [message,setMessage]=useState("");
  const tapBtnRef=useRef<HTMLButtonElement>(null);

  const num=(key:string,fallback:number)=>{const n=Number(settings[key]);return Number.isFinite(n)&&n>=0?n:fallback;};
  const MAX_ENERGY=Math.max(1,num("tap_max_energy",500));
  const REGEN_PER_SEC=num("tap_energy_regen_per_hour",50)/3600;
  const TAP_REWARD=Math.max(1,num("tap_reward_points",1));
  const X2_DURATION_SEC=Math.max(1,num("tap_x2_duration_seconds",10));
  const FAST_DURATION_SEC=Math.max(1,num("tap_fast_regen_duration_seconds",60));
  const FAST_REGEN_MULT=Math.max(1,num("tap_fast_regen_multiplier",2));
  const FARM_DURATION_MS=Math.max(1,num("farm_duration_minutes",15))*60*1000;
  const FARM_REWARD=Math.max(0,num("farm_reward_points",100));
  const AD_MAX_PER_DAY=Math.max(1,num("max_ads_per_day",20));
  const AD_REWARD=Math.max(0,num("ad_reward_points",50));
  const AD_COOLDOWN_SEC=Math.max(0,num("ad_cooldown_seconds",10));
  const AD_INIT_DELAY_SEC=Math.max(0,num("ad_init_delay_seconds",10));
  const DROP_COOLDOWN_SEC=Math.max(0,num("daily_drop_cooldown_seconds",5));
  const DROP_BASE=Math.max(0,num("daily_drop_base",100));
  const DROP_INCREMENT=Math.max(0,num("daily_drop_increment",10));
  const DROP_MAX_DAYS=Math.max(1,Math.min(14,num("daily_drop_max_days",7)));
  const colors=["#4ade80","#4ade80","#ffbe00","#ffbe00","#22d3ee","#22d3ee","#a78bfa"];
  const DAILY_DROP=Array.from({length:DROP_MAX_DAYS},(_,i)=>({day:i+1,pts:DROP_BASE+(i*DROP_INCREMENT),color:colors[Math.min(i,colors.length-1)],label:`D${i+1}`}));

  const [energy,setEnergy]=useState<number>(()=>Number(localStorage.getItem("energy")||500));
  const [x2SecsLeft,setX2SecsLeft]=useState(()=>loadBoost("boostX2Exp"));
  const [fastSecsLeft,setFastSecsLeft]=useState(()=>loadBoost("boostFastExp"));
  const x2Active=x2SecsLeft>0,fastActive=fastSecsLeft>0;
  const [floatPts,setFloatPts]=useState<FloatPt[]>([]);
  const [farmStart,setFarmStart]=useState<number|null>(()=>{const s=localStorage.getItem("farmStart");return s?Number(s):null;});
  const [farmProgress,setFarmProgress]=useState(0),[farmReady,setFarmReady]=useState(false),[farmTimeLeft,setFarmTimeLeft]=useState(""),[farmClaiming,setFarmClaiming]=useState(false);
  const [dropStreak,setDropStreak]=useState(0),[dropClaimedToday,setDropClaimedToday]=useState(false),[dropClaiming,setDropClaiming]=useState(false),[dropLoading,setDropLoading]=useState(true),[dropCooldown,setDropCooldown]=useState(5);
  const dropClaimingRef=useRef(false);
  const [adsToday,setAdsToday]=useState(0),[adCooldown,setAdCooldown]=useState(10),[adLoading,setAdLoading]=useState(false);
  const isAdRunning=useRef(false);

  const reloadSettings=useCallback(async()=>{const s=await getSettings();setSettings(s);},[]);
  useEffect(()=>{reloadSettings();const id=setInterval(reloadSettings,5000);const f=()=>reloadSettings();window.addEventListener("focus",f);return()=>{clearInterval(id);window.removeEventListener("focus",f);};},[reloadSettings]);
  useEffect(()=>{setEnergy(p=>Math.min(MAX_ENERGY,Math.max(0,p)));setDropCooldown(p=>p>0?p:DROP_COOLDOWN_SEC);setAdCooldown(p=>p>0?p:AD_INIT_DELAY_SEC);},[MAX_ENERGY,DROP_COOLDOWN_SEC,AD_INIT_DELAY_SEC]);

  const showMsg=(text:string)=>{setMessage(text);setTimeout(()=>setMessage(""),2500);};
  const fmtBoost=(s:number)=>s>=60?`${Math.floor(s/60)}:${(s%60).toString().padStart(2,"0")}`:`${s}s`;

  useEffect(()=>{if(!user)return;getTransactions(user.id).then(setTransactions);loadTodayAds();loadDropState();},[user]);
  async function loadTodayAds(){if(!user)return;const start=new Date();start.setUTCHours(0,0,0,0);const{count}=await supabase.from("ad_logs").select("id",{count:"exact",head:true}).eq("user_id",user.id).eq("ad_type","ad_watch").gte("created_at",start.toISOString());setAdsToday(count||0);}
  async function loadDropState(){if(!user)return;setDropLoading(true);try{const today=new Date().toISOString().split("T")[0];const{data:todayClaim}=await supabase.from("daily_claims").select("id").eq("user_id",user.id).eq("claim_date",today).maybeSingle();const claimed=!!todayClaim;setDropClaimedToday(claimed);const{data:claims}=await supabase.from("daily_claims").select("claim_date").eq("user_id",user.id).order("claim_date",{ascending:false}).limit(DROP_MAX_DAYS+1);if(!claims?.length){setDropStreak(0);return;}let streak=0;const now=new Date();now.setUTCHours(0,0,0,0);const offset=claimed?0:1;for(let i=0;i<claims.length;i++){const cd=new Date(claims[i].claim_date);const ex=new Date(now);ex.setUTCDate(now.getUTCDate()-(i+offset));if(cd.toISOString().split("T")[0]===ex.toISOString().split("T")[0])streak++;else break;}setDropStreak(streak);}finally{setDropLoading(false);}}

  useEffect(()=>{const tmr=setInterval(()=>setEnergy(prev=>{if(prev>=MAX_ENERGY)return MAX_ENERGY;const next=Math.min(MAX_ENERGY,prev+REGEN_PER_SEC*(fastActive?FAST_REGEN_MULT:1));localStorage.setItem("energy",String(next));localStorage.setItem("lastEnergyTime",String(Date.now()));return next;}),1000);return()=>clearInterval(tmr);},[MAX_ENERGY,REGEN_PER_SEC,FAST_REGEN_MULT,fastActive]);
  useEffect(()=>{const tmr=setInterval(()=>{setX2SecsLeft(p=>Math.max(0,p-1));setFastSecsLeft(p=>Math.max(0,p-1));setAdCooldown(p=>Math.max(0,p-1));setDropCooldown(p=>Math.max(0,p-1));},1000);return()=>clearInterval(tmr);},[]);
  useEffect(()=>{if(!farmStart)return;const tmr=setInterval(()=>{const elapsed=Date.now()-farmStart;const pct=Math.min(100,(elapsed/FARM_DURATION_MS)*100);setFarmProgress(pct);if(elapsed>=FARM_DURATION_MS){setFarmReady(true);setFarmProgress(100);setFarmTimeLeft("Ready!");clearInterval(tmr);}else{const rem=Math.ceil((FARM_DURATION_MS-elapsed)/1000);setFarmTimeLeft(`${Math.floor(rem/60)}:${(rem%60).toString().padStart(2,"0")}`);}},500);return()=>clearInterval(tmr);},[farmStart,FARM_DURATION_MS]);

  async function reward(points:number,type:string,desc:string){const r=await claimHomeReward(type,points,desc);if(!r.success)throw new Error(r.message||"Reward failed");await refreshBalance();if(user)getTransactions(user.id).then(setTransactions);return r;}
  async function handleTap(e:React.MouseEvent<HTMLButtonElement>){if(!user||energy<1)return;triggerHaptic("impact");const pts=TAP_REWARD*(x2Active?2:1);setEnergy(p=>Math.max(0,p-1));const rect=tapBtnRef.current?.getBoundingClientRect();const id=Date.now()+Math.random();setFloatPts(p=>[...p,{id,x:rect?e.clientX-rect.left-14:50,y:rect?e.clientY-rect.top-30:20,val:pts}]);setTimeout(()=>setFloatPts(p=>p.filter(f=>f.id!==id)),900);try{await reward(pts,"tap_earn",`👆 Tap${x2Active?" (2x)":""}`);}catch(e){showMsg((e as Error).message);}}

  const onX2Reward=useCallback(()=>{const exp=Date.now()+X2_DURATION_SEC*1000;saveBoost("boostX2Exp",exp);setX2SecsLeft(X2_DURATION_SEC);triggerHaptic("success");showMsg(`⚡ 2x active for ${X2_DURATION_SEC}s!`);},[X2_DURATION_SEC]);
  const{showAd:showX2Ad}=useRewardedAd(onX2Reward);
  const onFastReward=useCallback(()=>{const exp=Date.now()+FAST_DURATION_SEC*1000;saveBoost("boostFastExp",exp);setFastSecsLeft(FAST_DURATION_SEC);triggerHaptic("success");showMsg(`🔋 Fast charge for ${FAST_DURATION_SEC}s!`);},[FAST_DURATION_SEC]);
  const{showAd:showFastAd}=useRewardedAd(onFastReward);

  async function handleClaimDrop(){if(!user||dropClaimedToday||dropClaiming||dropLoading||dropCooldown>0||dropClaimingRef.current)return;dropClaimingRef.current=true;setDropClaiming(true);try{const dayIndex=Math.min(dropStreak,DAILY_DROP.length-1);const pts=DAILY_DROP[dayIndex]?.pts||DROP_BASE;await reward(pts,"daily_drop",`🎁 Daily Drop Day ${dayIndex+1}: +${pts} pts`);setDropClaimedToday(true);setDropStreak(p=>p+1);showMsg(`+${pts} pts 🎁 Day ${dayIndex+1}!`);}catch(e){const msg=(e as Error).message;if(/already|claimed|once per day|today/i.test(msg))setDropClaimedToday(true);showMsg(msg);}finally{setDropClaiming(false);dropClaimingRef.current=false;}}

  const onFarmStartReward=useCallback(()=>{const now=Date.now();setFarmStart(now);setFarmProgress(0);setFarmReady(false);localStorage.setItem("farmStart",String(now));triggerHaptic("impact");showMsg("🌾 Farming started!");},[]);
  const{showAd:showFarmStartAd}=useRewardedAd(onFarmStartReward);
  const onFarmClaimReward=useCallback(async()=>{if(!user)return;try{await reward(FARM_REWARD,"farm_claim",`🌾 Farm: +${FARM_REWARD} pts`);setFarmStart(null);setFarmProgress(0);setFarmReady(false);setFarmTimeLeft("");localStorage.removeItem("farmStart");showMsg(`+${FARM_REWARD} pts 🌾`);}catch(e){showMsg((e as Error).message);}},[user,FARM_REWARD]);
  const{showAd:showFarmClaimAd}=useRewardedAd(onFarmClaimReward);
  async function handleFarmStart(){if(farmStart)return;setFarmClaiming(true);try{await showFarmStartAd();}finally{setFarmClaiming(false);}}
  async function handleFarmClaim(){if(!farmReady||farmClaiming)return;setFarmClaiming(true);try{await showFarmClaimAd();}finally{setFarmClaiming(false);}}

  const onAdReward=useCallback(async()=>{if(!user)return;triggerHaptic("success");const r=await logAdWatch(user.id,"ad_watch",AD_REWARD);if(!(r as any).success){showMsg((r as any).message||"Ad reward failed");return;}await refreshBalance();setAdsToday(p=>p+1);setAdCooldown(AD_COOLDOWN_SEC);showMsg(`+${AD_REWARD} pts 🎬`);getTransactions(user.id).then(setTransactions);},[user,AD_REWARD,AD_COOLDOWN_SEC,refreshBalance]);
  const{showAd:showMainAd}=useRewardedAd(onAdReward);
  async function handleWatchAd(){if(!user||isAdRunning.current||adCooldown>0||adsToday>=AD_MAX_PER_DAY)return;isAdRunning.current=true;setAdLoading(true);try{await showMainAd();}finally{setAdLoading(false);isAdRunning.current=false;}}

  const energyPct=Math.min(100,(energy/MAX_ENERGY)*100),energyColor=energyPct>50?"#ffbe00":energyPct>20?"#f97316":"#ef4444";
  const isFarming=!!farmStart&&!farmReady;
  const todayDayIdx=Math.max(0,Math.min(dropStreak-(dropClaimedToday?1:0),DAILY_DROP.length-1));
  const dropBtnDisabled=dropClaimedToday||dropClaiming||dropLoading||dropCooldown>0;

  return <><style>{CSS}</style><div className="hp-root">
    {message&&<div className="hp-msg">✦ {message}</div>}
    <div className="hp-tap-card"><div className="hp-tap-header"><div className="hp-tap-title">⚡ TAP <span>{t('earn')}</span></div><div className="hp-energy-pill">⚡ {Math.floor(energy)}/{MAX_ENERGY}</div></div><div className="hp-tap-center"><div className="hp-tap-btn-wrap"><div className="hp-tap-ripple"/><div className="hp-tap-ripple"/><div className="hp-tap-ripple"/><button ref={tapBtnRef} className="hp-tap-btn" onClick={handleTap} disabled={energy<1}><span className="hp-tap-btn-emoji">🪙</span><span className="hp-tap-btn-sub">+{TAP_REWARD*(x2Active?2:1)} PTS</span></button>{floatPts.map(f=><div key={f.id} className="hp-float-pts" style={{left:f.x,top:f.y}}>+{f.val}</div>)}</div><div className="hp-energy-wrap"><div className="hp-energy-labels"><span>ENERGY</span><span style={{color:energyColor}}>{energy>=MAX_ENERGY?"⚡ FULL":fastActive?`⚡ FAST ×${FAST_REGEN_MULT}`:`+${(REGEN_PER_SEC*60).toFixed(1)}/min`}</span></div><div className="hp-energy-track"><div className="hp-energy-fill" style={{width:`${energyPct}%`,background:`linear-gradient(90deg,${energyColor}80,${energyColor})`}}/></div>{energy<1&&<div className="hp-regen-label">⏳ Recharging...</div>}</div></div><div className="hp-boost-row"><button className="hp-boost-btn x2" onClick={()=>!x2Active&&showX2Ad()} disabled={x2Active}><div className="hp-boost-label">⚡ 2× TAP</div>{x2Active?<div className="hp-boost-timer">{fmtBoost(x2SecsLeft)}</div>:<div className="hp-boost-sub">{t('watchAds')} • {X2_DURATION_SEC}s</div>}</button><button className="hp-boost-btn fast" onClick={()=>!fastActive&&showFastAd()} disabled={fastActive}><div className="hp-boost-label">🔋 FAST ×{FAST_REGEN_MULT}</div>{fastActive?<div className="hp-boost-timer">{fmtBoost(fastSecsLeft)}</div>:<div className="hp-boost-sub">{t('watchAds')} • {FAST_DURATION_SEC}s</div>}</button></div></div>

    <div className="hp-drop-card"><div className="hp-drop-header"><div className="hp-drop-title">🎁 {t('dailyDrop')}</div><div className="hp-drop-streak">🔥 {dropStreak>0?`${Math.min(dropStreak,DROP_MAX_DAYS)} Day${dropStreak>1?"s":""}`:"New"}</div></div>{dropLoading?<div className="hp-drop-loading"><div className="hp-drop-spin"/>Loading...</div>:<div className="hp-drop-days">{DAILY_DROP.map((d,i)=>{const claimed=i<todayDayIdx||(i===todayDayIdx&&dropClaimedToday),locked=i>todayDayIdx;return <div key={d.day} className={`hp-drop-day ${claimed?"claimed":""} ${locked?"locked":""}`} style={i===todayDayIdx&&!dropClaimedToday?{borderColor:d.color}:undefined}>{claimed&&<div className="hp-drop-check">✓</div>}<div className="hp-drop-pts" style={{color:claimed?"#4ade80":locked?"rgba(255,255,255,.25)":d.color}}>{d.pts}</div><div className="hp-drop-dlabel">{d.label}</div></div>;})}</div>}<button className={`hp-drop-btn ${dropClaimedToday?"claimed":dropCooldown>0||dropLoading?"cooldown":"claim"}`} onClick={handleClaimDrop} disabled={dropBtnDisabled}>{dropClaiming?"CLAIMING...":dropClaimedToday?`✅ ${t('claimedToday')}`:dropLoading?"Loading...":dropCooldown>0?`⏳ Available in ${dropCooldown}s`:`🎁 ${t('claim').toUpperCase()} +${DAILY_DROP[todayDayIdx]?.pts||DROP_BASE} PTS`}</button></div>

    <div className="hp-farm-card"><div className="hp-farm-top"><div className="hp-farm-icon">🌾</div><div className="hp-farm-info"><div className="hp-farm-title">{t('farming').toUpperCase()}</div><div className={`hp-farm-sub ${isFarming||farmReady?"live":""}`}>{farmReady?"✦ Ready to claim!":isFarming?`⏱ ${farmTimeLeft} remaining`:`${t('farming')} → ${num("farm_duration_minutes",15)} min → +${FARM_REWARD} pts`}</div></div><div className="hp-farm-badge">+{FARM_REWARD} PTS</div></div><div className="hp-farm-prog-labels"><span>{farmReady?"Complete!":isFarming?`${t('farming')}...`:"Idle"}</span><span>{Math.round(farmProgress)}%</span></div><div className="hp-farm-track"><div className="hp-farm-fill" style={{width:`${farmProgress}%`,background:farmReady?"linear-gradient(90deg,#ffbe00,#f59e0b)":"linear-gradient(90deg,#4ade80,#22d3ee)"}}/></div>{farmReady?<button className="hp-farm-btn claim" onClick={handleFarmClaim} disabled={farmClaiming}>🚜 {t('claim').toUpperCase()}</button>:isFarming?<button className="hp-farm-btn wait" disabled>🌾 {t('farming').toUpperCase()}... {farmTimeLeft}</button>:<button className="hp-farm-btn start" onClick={handleFarmStart} disabled={farmClaiming}>🌾 {t('farming').toUpperCase()}</button>}</div>

    <div className="hp-ad-card"><div className="hp-ad-top"><div className="hp-ad-icon">🎬</div><div className="hp-ad-info"><div className="hp-ad-title">{t('watchAds').toUpperCase()}</div><div className="hp-ad-sub">{adsToday>=AD_MAX_PER_DAY?"✅ Daily limit reached":`${adsToday} / ${AD_MAX_PER_DAY} today`}</div></div><div className="hp-ad-badge">+{AD_REWARD} PTS</div></div><div className="hp-ad-prog-track"><div className="hp-ad-prog-fill" style={{width:`${Math.min(100,(adsToday/AD_MAX_PER_DAY)*100)}%`,background:"linear-gradient(90deg,#ffbe00,#f59e0b)"}}/></div><button className={`hp-ad-btn ${adsToday>=AD_MAX_PER_DAY||adCooldown>0?"ghost":"gold-btn"}`} onClick={handleWatchAd} disabled={adLoading||adCooldown>0||adsToday>=AD_MAX_PER_DAY}>{adLoading?"LOADING...":adsToday>=AD_MAX_PER_DAY?"✅ COME BACK TOMORROW":adCooldown>0?`⏳ ${adsToday===0?"READY":"NEXT AD"} IN ${adCooldown}s`:`🎬 ${t('watchAds').toUpperCase()} +${AD_REWARD} PTS`}</button></div>

    <div className="hp-tabs"><button className={`hp-tab ${activeTab==="earn"?"active":""}`} onClick={()=>setActiveTab("earn")}>{t('earn')}</button><button className={`hp-tab ${activeTab==="history"?"active":""}`} onClick={()=>setActiveTab("history")}>{t('history')}</button></div>
    {activeTab==="earn"?<div><div style={{textAlign:"center",padding:"14px 0 12px",fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:"3px",color:"rgba(255,255,255,.1)",textTransform:"uppercase"}}>✦ {t('earn')} ✦</div><AdsgramTask blockId="task-25198"/></div>:<div>{transactions.length===0?<div className="hp-tx-empty">No transactions yet</div>:transactions.map(tx=><div key={tx.id} className="hp-tx"><div className="hp-tx-icon">{txIcon(tx.type)}</div><div className="hp-tx-body"><div className="hp-tx-label">{txLabel(tx.type)}</div><div className="hp-tx-sub">{t('points')} {t('earn').toLowerCase()}</div></div><div className="hp-tx-pts">+{tx.points}</div></div>)}</div>}
  </div></>;
}

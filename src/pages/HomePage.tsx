import React,{useCallback,useEffect,useMemo,useRef,useState}from'react';
import{Clock3,Gift,Info,Leaf,LockKeyhole,PlayCircle,RefreshCw,Sparkles,Ticket,WalletCards}from'lucide-react';
import{useApp}from'@/context/AppContext';
import{usePreferences}from'@/context/PreferencesContext';
import{claimDailyDrop,claimFarm,claimPromoCode,getAdProviderState,getHomeRewardState,getTransactions,logAdWatch,startFarm,type AdProviderState,type HomeRewardState}from'@/lib/api';
import{showRewardAd,type RewardAdProvider}from'@/lib/adNetworks';
import{showInterstitialAd}from'@/hooks/useAdsgram';
import AdsgramTask from'@/components/AdsgramTask';

const CSS=`
.hv-root{padding:2px 15px 116px;color:inherit}.hv-hero,.hv-card,.hv-adcard,.hv-tx{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:linear-gradient(145deg,rgba(255,255,255,.095),rgba(255,255,255,.025)),rgba(8,13,24,.46);box-shadow:inset 0 1px rgba(255,255,255,.14),0 14px 36px rgba(0,0,0,.18);backdrop-filter:blur(24px) saturate(145%)}.hv-sponsored{margin-top:11px}
.hv-hero{border-radius:26px;padding:18px;margin-bottom:11px;animation:hv-rise .5s cubic-bezier(.2,.8,.2,1) both}.hv-hero::after{content:'';position:absolute;width:110px;height:110px;border-radius:50%;right:-36px;top:-48px;background:radial-gradient(circle,rgba(255,216,77,.24),transparent 68%);animation:hv-pulse 3.2s ease-in-out infinite}.hv-kicker{font:700 9px 'Orbitron',sans-serif;letter-spacing:2.4px;opacity:.38;text-transform:uppercase;display:flex;align-items:center;gap:6px}.hv-kicker svg{width:13px}.hv-balance{font:900 30px 'Orbitron',sans-serif;margin:6px 0 0;color:#ffe08a;position:relative;z-index:1}.hv-balance small{font-size:12px;letter-spacing:1px;opacity:.7}.hv-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}.hv-card{border-radius:22px;padding:15px;min-height:158px;animation:hv-rise .5s cubic-bezier(.2,.8,.2,1) both}.hv-grid .hv-card:nth-child(1){animation-delay:.06s}.hv-grid .hv-card:nth-child(2){animation-delay:.1s}.hv-grid .hv-card:nth-child(3){animation-delay:.14s}.hv-card.full{grid-column:1/-1;min-height:auto}.hv-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.hv-icon{width:39px;height:39px;border-radius:14px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.055);animation:hv-float 3s ease-in-out infinite}.hv-icon svg{width:19px;height:19px}.hv-title{font:800 11px 'Orbitron',sans-serif;letter-spacing:.8px;margin-top:12px}.hv-sub{font-size:11px;line-height:1.38;opacity:.47;margin-top:5px}.hv-value{font:800 15px 'Orbitron',sans-serif;margin-top:10px}.hv-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.065);overflow:hidden;margin:10px 0}.hv-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#60a5fa,#34d399,#60a5fa);background-size:180% 100%;transition:width .35s;animation:hv-flow 2s linear infinite}.hv-btn{width:100%;border:0;border-radius:14px;padding:11px 10px;font:750 10px 'Orbitron',sans-serif;letter-spacing:.65px;display:flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#ffd84d,#f59e0b);color:#171006;transition:transform .18s,filter .18s}.hv-btn:active:not(:disabled){transform:scale(.96)}.hv-btn svg{width:15px}.hv-btn.secondary{background:rgba(255,255,255,.055);border:1px solid rgba(255,255,255,.09);color:inherit}.hv-btn:disabled{opacity:.42}.hv-days{display:flex;gap:5px;overflow:auto;margin:12px 0 2px;scrollbar-width:none}.hv-days::-webkit-scrollbar{display:none}.hv-day{min-width:43px;flex:1;padding:8px 3px;border-radius:12px;text-align:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);transition:transform .2s,border-color .2s}.hv-day.done{border-color:rgba(52,211,153,.28);background:rgba(52,211,153,.08)}.hv-day.now{border-color:rgba(255,208,80,.52);animation:hv-day 1.8s ease-in-out infinite}.hv-day-pts{font:800 10px 'Orbitron',sans-serif}.hv-day-label{font-size:8px;opacity:.38;margin-top:3px}.hv-section{font:700 9px 'Orbitron',sans-serif;letter-spacing:2px;opacity:.32;text-transform:uppercase;margin:16px 2px 8px}.hv-info{display:flex;align-items:flex-start;gap:8px;padding:11px 12px;border-radius:15px;margin-top:10px;font-size:10px;line-height:1.45;background:rgba(34,211,238,.06);border:1px solid rgba(34,211,238,.13);color:rgba(226,232,240,.62)}.hv-info svg{width:15px;flex:0 0 15px;color:#67e8f9}.hv-message{padding:10px 12px;border-radius:14px;margin-bottom:10px;font-size:11px;line-height:1.55;white-space:pre-line;background:rgba(34,211,238,.07);border:1px solid rgba(34,211,238,.14);animation:hv-pop .24s ease-out}.hv-tx{border-radius:15px;padding:11px 12px;margin-bottom:7px;display:flex;align-items:center;gap:10px;animation:hv-rise .35s ease-out both}.hv-tx svg{width:17px;opacity:.7}.hv-tx-main{flex:1}.hv-tx-title{font-size:12px;font-weight:700;text-transform:capitalize}.hv-tx-points{font:700 10px 'Orbitron',sans-serif;color:#ffd45c}.hv-loading{padding:34px 10px;text-align:center;opacity:.45;font:700 9px 'Orbitron',sans-serif;letter-spacing:2px}.hv-spin{animation:hv-spin 1s linear infinite}.hv-promo{padding:12px 13px;border-radius:18px;margin:10px 0;background:linear-gradient(145deg,rgba(255,255,255,.07),rgba(255,255,255,.025)),rgba(8,13,24,.35);border:1px solid rgba(255,255,255,.08)}.hv-promo-head{display:flex;align-items:center;gap:7px;font:800 10px 'Orbitron',sans-serif;letter-spacing:.7px;margin-bottom:8px}.hv-promo-head svg{width:15px;color:#ffd45c}.hv-promo-row{display:flex;gap:7px}.hv-promo-input{flex:1;min-width:0;border-radius:12px;border:1px solid rgba(255,255,255,.09);background:rgba(0,0,0,.16);color:inherit;padding:10px 11px;font-size:12px;text-transform:uppercase;outline:none}.hv-promo-input:focus{border-color:rgba(255,216,77,.35)}.hv-promo-claim{flex:0 0 auto;border:0;border-radius:12px;padding:0 14px;background:linear-gradient(135deg,#ffd84d,#f59e0b);color:#171006;font:800 9px 'Orbitron',sans-serif;letter-spacing:.6px}.hv-promo-claim:disabled{opacity:.4}
.hv-adcard{border-radius:24px;padding:15px;animation:hv-rise .45s cubic-bezier(.2,.8,.2,1) both}.hv-adcard::before{content:'';position:absolute;inset:-45% auto auto -12%;width:160px;height:160px;border-radius:50%;background:radial-gradient(circle,rgba(34,211,238,.16),transparent 70%);pointer-events:none}.hv-ad-head{display:flex;align-items:center;gap:11px;position:relative}.hv-ad-logo{width:48px;height:48px;border-radius:17px;display:grid;place-items:center;flex:0 0 auto;background:linear-gradient(145deg,rgba(34,211,238,.15),rgba(255,216,77,.08));border:1px solid rgba(103,232,249,.18);box-shadow:inset 0 1px rgba(255,255,255,.12)}.hv-ad-logo svg{width:22px;height:22px;color:#67e8f9}.hv-ad-main{flex:1;min-width:0}.hv-ad-name{font:850 14px 'Orbitron',sans-serif;letter-spacing:.45px}.hv-ad-copy{font-size:10px;line-height:1.4;opacity:.48;margin-top:3px}.hv-ad-status{font:800 8px 'Orbitron',sans-serif;letter-spacing:.7px;padding:7px 8px;border-radius:99px;border:1px solid rgba(74,222,128,.2);background:rgba(74,222,128,.08);color:#4ade80;white-space:nowrap}.hv-ad-status.wait{color:#67e8f9;border-color:rgba(103,232,249,.2);background:rgba(103,232,249,.08)}.hv-ad-status.limit,.hv-ad-status.off{color:#fbbf24;border-color:rgba(251,191,36,.2);background:rgba(251,191,36,.08)}.hv-ad-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:14px 0 11px;position:relative}.hv-ad-stat{padding:9px 7px;border-radius:13px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);text-align:center}.hv-ad-stat strong{display:block;font:800 11px 'Orbitron',sans-serif}.hv-ad-stat span{display:block;font-size:8px;opacity:.4;margin-top:3px}.hv-ad-progress{height:6px;border-radius:99px;background:rgba(255,255,255,.06);overflow:hidden;margin-bottom:12px}.hv-ad-progress span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#22d3ee,#ffd84d);transition:width .35s}.hv-ad-action{width:100%;min-height:48px;border:0;border-radius:15px;padding:12px 14px;display:flex;align-items:center;justify-content:center;gap:8px;font:850 10px 'Orbitron',sans-serif;letter-spacing:.75px;background:linear-gradient(135deg,#22d3ee,#facc15);color:#071018;box-shadow:0 10px 26px rgba(34,211,238,.09);transition:transform .18s,filter .18s}.hv-ad-action:active:not(:disabled){transform:scale(.97)}.hv-ad-action:disabled{opacity:.38;box-shadow:none}.hv-ad-action svg{width:17px}.hv-ad-note{display:flex;gap:7px;align-items:flex-start;margin-top:10px;font-size:9px;line-height:1.45;opacity:.5}.hv-ad-note svg{width:13px;flex:0 0 13px;margin-top:1px}
@keyframes hv-spin{to{transform:rotate(360deg)}}@keyframes hv-rise{from{opacity:0;transform:translateY(13px) scale(.985)}to{opacity:1;transform:none}}@keyframes hv-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}@keyframes hv-flow{to{background-position:180% 0}}@keyframes hv-float{50%{transform:translateY(-3px)}}@keyframes hv-pulse{50%{transform:scale(1.12);opacity:.7}}@keyframes hv-day{50%{transform:translateY(-2px);box-shadow:0 0 18px rgba(255,208,80,.12)}}
[data-theme='light'] .hv-hero,[data-theme='light'] .hv-card,[data-theme='light'] .hv-adcard,[data-theme='light'] .hv-tx,[data-theme='light'] .hv-promo{background:linear-gradient(145deg,rgba(255,255,255,.96),rgba(245,248,255,.8));border-color:rgba(15,23,42,.09);box-shadow:0 12px 32px rgba(45,58,85,.08);color:#0f172a}[data-theme='light'] .hv-icon,[data-theme='light'] .hv-btn.secondary,[data-theme='light'] .hv-day,[data-theme='light'] .hv-ad-stat{background:rgba(15,23,42,.035);border-color:rgba(15,23,42,.08);color:#0f172a}[data-theme='light'] .hv-bar,[data-theme='light'] .hv-ad-progress{background:rgba(15,23,42,.07)}[data-theme='light'] .hv-balance{color:#9a6300}[data-theme='light'] .hv-info{color:#334155}[data-theme='light'] .hv-promo-input{background:rgba(15,23,42,.035);border-color:rgba(15,23,42,.1);color:#0f172a}
@media(prefers-reduced-motion:reduce){.hv-root *{animation-duration:.01ms!important;animation-iteration-count:1!important;scroll-behavior:auto!important}.hv-btn,.hv-ad-action{transition:none}}
`;

const fmt=(ms:number)=>{const total=Math.max(0,Math.floor(ms/1000));const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`};

export default function HomePage(){
 const{balance,settings,refreshBalance}=useApp();
 const{t}=usePreferences();
 const[home,setHome]=useState<HomeRewardState|null>(null);
 const[adState,setAdState]=useState<AdProviderState|null>(null);
 const[transactions,setTransactions]=useState<Array<{id:string;type:string;points:number}>>([]);
 const[hasLoaded,setHasLoaded]=useState(false);
 const[busy,setBusy]=useState<string|null>(null);
 const[message,setMessage]=useState('');
 const[promoCode,setPromoCode]=useState('');
 const[now,setNow]=useState(Date.now());
 const messageTimer=useRef<number>();

 const load=useCallback(async()=>{
  try{
   const[state,providers,tx]=await Promise.all([getHomeRewardState(),getAdProviderState(),getTransactions('self')]);
   if(state)setHome(state);
   if(providers)setAdState(providers);
   setTransactions((tx||[]).slice(0,5));
  }finally{setHasLoaded(true)}
 },[]);

 useEffect(()=>{
  void load();
  const tick=window.setInterval(()=>setNow(Date.now()),1000);
  const refresh=()=>void load();
  window.addEventListener('focus',refresh);
  return()=>{window.clearInterval(tick);window.clearTimeout(messageTimer.current);window.removeEventListener('focus',refresh)};
 },[load]);

 useEffect(()=>{
  if(!Object.keys(settings).length)return;
  let active=true;
  void getAdProviderState().then(state=>{if(active&&state)setAdState(state)}).finally(()=>{if(active)setHasLoaded(true)});
  return()=>{active=false};
 },[settings]);

 useEffect(()=>{
  const targets=[home?.drop.nextResetAt,adState?.nextResetAt]
   .filter(Boolean)
   .map(value=>new Date(value as string).getTime())
   .filter(value=>value>Date.now());
  if(!targets.length)return;
  const timer=window.setTimeout(()=>void load(),Math.min(2_147_000_000,Math.max(250,Math.min(...targets)-Date.now()+250)));
  return()=>window.clearTimeout(timer);
 },[home?.drop.nextResetAt,adState?.nextResetAt,load]);

 const flash=(text:string)=>{
  setMessage(text);
  window.clearTimeout(messageTimer.current);
  messageTimer.current=window.setTimeout(()=>setMessage(''),3600);
 };

 const farmReadyAt=home?.farm.readyAt?new Date(home.farm.readyAt).getTime():0;
 const farmStarted=Boolean(home?.farm.startedAt);
 const farmReady=farmStarted&&farmReadyAt<=now;
 const farmPct=farmStarted?Math.min(100,Math.max(0,100-(Math.max(0,farmReadyAt-now)/(Math.max(1,home!.farm.durationMinutes)*60000))*100)):0;
 const nextDropMs=home?.drop.nextResetAt?new Date(home.drop.nextResetAt).getTime()-now:0;
 const currentDropDay=Math.max(1,Math.min(home?.drop.maxDays||1,(home?.drop.streak||0)+(home?.drop.claimedToday?0:1)));
 const dropDays=useMemo(()=>home?Array.from({length:home.drop.maxDays},(_,index)=>({day:index+1,points:home.drop.base+index*home.drop.increment})):[],[home]);

 async function farmAction(){
  if(!home)return;
  setBusy('farm');
  try{
   await showInterstitialAd();
   const result=farmReady?await claimFarm():await startFarm();
   if(result.success){
    flash(farmReady?`+${result.points||home.farm.rewardPoints} ADR`:'Farm started');
    await Promise.all([refreshBalance(),load()]);
   }else flash(result.message||'Try again');
  }finally{setBusy(null)}
 }

 async function dropAction(){
  if(!home||home.drop.claimedToday)return;
  setBusy('drop');
  const result=await claimDailyDrop();
  if(result.success){
   flash(`+${result.points||0} ADR`);
   await Promise.all([refreshBalance(),load()]);
  }else flash(result.message||'Try again');
  setBusy(null);
 }

 async function promoAction(){
  const code=promoCode.trim().toUpperCase();
  if(!code){flash('Enter promo code');return;}
  setBusy('promo');
  try{
   const result=await claimPromoCode(code);
   if(result.success){
    const reward=Number(result.reward||0);
    const nextBalance=Number(result.balance??balance?.points??0);
    setPromoCode('');
    flash(`🎉 Promo Claimed\n🎁 +${reward.toLocaleString()} ADR\n💎 Balance: ${nextBalance.toLocaleString()} ADR`);
    await Promise.all([refreshBalance(),load()]);
   }else flash(result.message||'Invalid code');
  }finally{setBusy(null)}
 }

 async function watch(provider:RewardAdProvider){
  const status=adState?.providers[provider];
  const cooling=Boolean(status?.nextAvailableAt&&new Date(status.nextAvailableAt).getTime()>Date.now());
  if(!adState||busy||!status?.enabled||status.count>=status.limit||cooling)return;
  setBusy(provider);
  try{
   await showRewardAd(provider);
   const result=await logAdWatch('self','ad_watch',adState.rewardPoints,provider);
   if(!result.success)throw new Error(result.message||'Ad reward failed');
   flash(`+${result.points??adState.rewardPoints} ADR`);
   await Promise.all([refreshBalance(),load()]);
  }catch(error){flash((error as Error).message)}finally{setBusy(null)}
 }

 const adsgram=adState?.providers.adsgram;
 const adsgramCooldown=adsgram?.nextAvailableAt?new Date(adsgram.nextAvailableAt).getTime()-now:0;
 const adsgramLimit=Boolean(adsgram&&adsgram.count>=adsgram.limit);
 const adsgramDisabled=Boolean(adsgram&&!adsgram.enabled);
 const adsgramWaiting=Boolean(adsgram&&adsgramCooldown>0&&!adsgramLimit);
 const adsgramState=adsgramDisabled?'OFF':adsgramLimit&&adState?fmt(new Date(adState.nextResetAt).getTime()-now):adsgramWaiting?fmt(adsgramCooldown):'READY';
 const AdsgramStateIcon=adsgramDisabled||adsgramLimit?LockKeyhole:adsgramWaiting?Clock3:PlayCircle;

 return <><style>{CSS}</style><div className="hv-root">
  {!hasLoaded&&!home?<div className="hv-loading"><RefreshCw className="hv-spin" style={{width:20,margin:'0 auto 10px'}}/>{t('loading')}</div>:!home?<section className="hv-card full"><div className="hv-info"><Info/><span>Rewards are temporarily unavailable. Please try again.</span></div><button className="hv-btn secondary" onClick={()=>void load()}><RefreshCw/>Retry</button></section>:<>
   {message?<div className="hv-message" role="status" aria-live="polite">{message}</div>:null}
   <section className="hv-hero"><div className="hv-kicker"><WalletCards/>{t('availableBalance')}</div><div className="hv-balance">{balance?.points==null?'•••':balance.points.toLocaleString()} <small>ADR</small></div></section>
   <div className="hv-grid">
    <section className="hv-card"><div className="hv-top"><div className="hv-icon"><Leaf/></div><span className="hv-kicker">+{home!.farm.rewardPoints} ADR</span></div><div className="hv-title">{t('farming')}</div>{!farmStarted?<div className="hv-sub">{home!.farm.durationMinutes} min · +{home!.farm.rewardPoints} ADR</div>:null}<div className="hv-bar"><div className="hv-fill" style={{width:`${farmPct}%`}}/></div><button className={`hv-btn ${farmStarted&&!farmReady?'secondary':''}`} disabled={busy==='farm'||(farmStarted&&!farmReady)} onClick={()=>void farmAction()}>{farmStarted&&!farmReady?<><Clock3/>{fmt(farmReadyAt-now)}</>:farmReady?<><Sparkles/>{t('claim')}</>:<><PlayCircle/>{t('startFarming')}</>}</button></section>
    <section className="hv-card"><div className="hv-top"><div className="hv-icon"><Gift/></div><span className="hv-kicker">{t('day')} {currentDropDay}</span></div><div className="hv-title">{t('dailyDrop')}</div><div className="hv-value">+{dropDays[currentDropDay-1]?.points||0} ADR</div><button className={`hv-btn ${home!.drop.claimedToday?'secondary':''}`} disabled={home!.drop.claimedToday||busy==='drop'} onClick={()=>void dropAction()}>{home!.drop.claimedToday?<><LockKeyhole/>{fmt(nextDropMs)}</>:<><Gift/>{t('claim')}</>}</button></section>
    <section className="hv-card full"><div className="hv-top"><div className="hv-kicker"><Gift/>{t('dailyDrop')}</div><span className="hv-kicker">{home!.drop.streak}/{home!.drop.maxDays}</span></div><div className="hv-days">{dropDays.map((day,index)=>{const done=index<(home!.drop.claimedToday?home!.drop.streak:Math.max(0,home!.drop.streak));const isNow=index===currentDropDay-1&&!home!.drop.claimedToday;return <div key={day.day} className={`hv-day ${done?'done':''} ${isNow?'now':''}`}><div className="hv-day-pts">{day.points} ADR</div><div className="hv-day-label">D{day.day}</div></div>})}</div></section>
   </div>
   <section className="hv-promo"><div className="hv-promo-head"><Ticket/>Promo Code</div><div className="hv-promo-row"><input className="hv-promo-input" value={promoCode} maxLength={8} autoCapitalize="characters" autoComplete="off" placeholder="Enter promo code" onChange={e=>setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8))} onKeyDown={e=>{if(e.key==='Enter')void promoAction()}}/><button className="hv-promo-claim" disabled={busy==='promo'||!promoCode.trim()} onClick={()=>void promoAction()}>{busy==='promo'?'…':'Claim'}</button></div></section>
   <div className="hv-section">{t('watchAds')}</div>
   {adState&&adsgram?<section className="hv-adcard">
    <div className="hv-ad-head"><div className="hv-ad-logo"><PlayCircle/></div><div className="hv-ad-main"><div className="hv-ad-name">AdsGram Rewards</div><div className="hv-ad-copy">Watch a verified ad and earn ADR instantly.</div></div><div className={`hv-ad-status ${adsgramLimit?'limit':adsgramWaiting?'wait':adsgramDisabled?'off':''}`}>{adsgramState}</div></div>
    <div className="hv-ad-stats"><div className="hv-ad-stat"><strong>{adsgram.count}/{adsgram.limit}</strong><span>Today</span></div><div className="hv-ad-stat"><strong>+{adState.rewardPoints}</strong><span>ADR / Ad</span></div><div className="hv-ad-stat"><strong>{adsgram.cooldownSeconds}s</strong><span>Cooldown</span></div></div>
    <div className="hv-ad-progress"><span style={{width:`${Math.min(100,adsgram.count/Math.max(1,adsgram.limit)*100)}%`}}/></div>
    <button className="hv-ad-action" disabled={Boolean(busy)||adsgramDisabled||adsgramLimit||adsgramWaiting} onClick={()=>void watch('adsgram')} aria-label="Watch AdsGram ad">{busy==='adsgram'?<RefreshCw className="hv-spin"/>:<AdsgramStateIcon/>}{adsgramDisabled?'Ads unavailable':adsgramLimit?'Daily limit reached':adsgramWaiting?`Next ad in ${fmt(adsgramCooldown)}`:'Watch ad & earn'}</button>
    <div className="hv-ad-note"><Info/><span>Complete the ad normally to receive your reward. Closing before completion cancels the reward. Daily reset in {fmt(new Date(adState.nextResetAt).getTime()-now)}.</span></div>
   </section>:<section className="hv-card full"><div className="hv-info"><Info/><span>AdsGram is temporarily unavailable. Your other rewards still work.</span></div><button className="hv-btn secondary" onClick={()=>void load()}><RefreshCw/>Retry ads</button></section>}
   <div className="hv-sponsored"><AdsgramTask blockId="task-25198" rewardAmount={10}/></div>
   <div className="hv-section">{t('history')}</div>
   {transactions.length===0?<div className="hv-sub" style={{padding:'12px 2px'}}>{t('noTransactions')}</div>:transactions.map(transaction=><div className="hv-tx" key={transaction.id}><Sparkles/><div className="hv-tx-main"><div className="hv-tx-title">{String(transaction.type||'reward').replaceAll('_',' ')}</div></div><div className="hv-tx-points">{Number(transaction.points)>0?'+':''}{Number(transaction.points||0)} ADR</div></div>)}
  </>}
 </div></>;
}
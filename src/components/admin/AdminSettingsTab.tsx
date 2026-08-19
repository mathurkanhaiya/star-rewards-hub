import React, { useMemo, useState } from 'react';

interface Props {
  settings: Record<string,string>;
  editSettings: Record<string,string>;
  setEditSettings: React.Dispatch<React.SetStateAction<Record<string,string>>>;
  onSave: (key:string)=>void;
  saving: string|null;
}

type Meta={label:string;desc:string;type:'number'|'text'|'toggle';unit?:string};
type Group={title:string;icon:string;keys:string[]};

const GROUPS:Group[]=[
  {title:'Ads',icon:'🎬',keys:['ad_reward_points','ad_cooldown_seconds','ad_init_delay_seconds','max_ads_per_hour','max_ads_per_day','adsgram_block_id']},
  {title:'Tap & Energy',icon:'👆',keys:['tap_reward_points','tap_max_energy','tap_energy_regen_per_hour','tap_rate_limit_per_second','tap_x2_duration_seconds','tap_fast_regen_duration_seconds','tap_fast_regen_multiplier']},
  {title:'Farm',icon:'🌾',keys:['farm_reward_points','farm_duration_minutes']},
  {title:'Daily Drop',icon:'🎁',keys:['daily_drop_base','daily_drop_increment','daily_drop_max_days','daily_drop_cooldown_seconds']},
  {title:'Daily Reward',icon:'🔥',keys:['daily_bonus_base','daily_bonus_streak_multiplier']},
  {title:'Spin Wheel',icon:'🎡',keys:['max_daily_spins','spin_cooldown_hours','spin_reward_min','spin_reward_max','spin_jackpot','spin_jackpot_chance']},
  {title:'Referrals',icon:'👥',keys:['points_per_referral','referral_bonus_referred','max_referral_bonus']},
  {title:'Games',icon:'🎮',keys:['game_daily_limit','tower_daily_limit','tower_max_reward','tower_reward_multiplier','dice_reward_enabled','cardflip_reward_enabled','numberguess_reward_enabled','luckybox_reward_enabled']},
  {title:'Withdrawals & Rates',icon:'💸',keys:['withdrawal_enabled','min_withdrawal_points','max_pending_withdrawals','max_daily_withdrawals','required_daily_ads','stars_conversion_rate','usdt_conversion_rate','ton_conversion_rate']},
  {title:'Leaderboard & Contest',icon:'🏆',keys:['leaderboard_refresh_seconds','leaderboard_max_entries','contest_max_winners']},
  {title:'Promo Defaults',icon:'🎟️',keys:['promo_default_reward','promo_default_max_claims']},
  {title:'System',icon:'⚙️',keys:['maintenance_mode','bot_name','app_version','support_username','channel_username']},
];

const M:Record<string,Meta>={
 ad_reward_points:{label:'Reward per Ad',desc:'Real backend points paid after a verified ad',type:'number',unit:'pts'},
 ad_cooldown_seconds:{label:'Time per Ad',desc:'Minimum wait between rewarded ads',type:'number',unit:'sec'},
 ad_init_delay_seconds:{label:'First Ad Delay',desc:'Delay after app opens before ads are enabled',type:'number',unit:'sec'},
 max_ads_per_hour:{label:'Ads per Hour',desc:'Rolling hourly rewarded-ad limit',type:'number'},
 max_ads_per_day:{label:'Ads per Day',desc:'Daily rewarded-ad limit',type:'number'},
 adsgram_block_id:{label:'Adsgram Block ID',desc:'Adsgram rewarded/task block identifier',type:'text'},
 tap_reward_points:{label:'Tap Reward',desc:'Base points per accepted tap',type:'number',unit:'pts'},
 tap_max_energy:{label:'Max Energy',desc:'Maximum tap energy',type:'number'},
 tap_energy_regen_per_hour:{label:'Energy Regen',desc:'Energy regenerated each hour',type:'number',unit:'/hr'},
 tap_rate_limit_per_second:{label:'Tap Rate Limit',desc:'Maximum taps accepted each second',type:'number',unit:'/sec'},
 tap_x2_duration_seconds:{label:'x2 Duration',desc:'Tap x2 boost duration',type:'number',unit:'sec'},
 tap_fast_regen_duration_seconds:{label:'Fast Regen Duration',desc:'Fast energy regeneration boost duration',type:'number',unit:'sec'},
 tap_fast_regen_multiplier:{label:'Fast Regen Multiplier',desc:'Energy regeneration multiplier during boost',type:'number',unit:'x'},
 farm_reward_points:{label:'Farm Reward',desc:'Points credited on a valid farm claim',type:'number',unit:'pts'},
 farm_duration_minutes:{label:'Farm Time',desc:'Time required between farm claims',type:'number',unit:'min'},
 daily_drop_base:{label:'Daily Drop Base',desc:'Day 1 Daily Drop reward',type:'number',unit:'pts'},
 daily_drop_increment:{label:'Daily Drop Increment',desc:'Extra points added for each streak day',type:'number',unit:'pts/day'},
 daily_drop_max_days:{label:'Daily Drop Max Days',desc:'Highest Daily Drop streak tier',type:'number',unit:'days'},
 daily_drop_cooldown_seconds:{label:'Drop UI Cooldown',desc:'Short cooldown after claiming Daily Drop',type:'number',unit:'sec'},
 daily_bonus_base:{label:'Daily Reward Base',desc:'Base Daily Reward amount',type:'number',unit:'pts'},
 daily_bonus_streak_multiplier:{label:'Daily Streak Bonus',desc:'Extra Daily Reward points per streak day',type:'number',unit:'pts/day'},
 max_daily_spins:{label:'Spins per Day',desc:'Maximum daily spin attempts',type:'number'},
 spin_cooldown_hours:{label:'Spin Reset',desc:'Spin reset/cooldown window',type:'number',unit:'hr'},
 spin_reward_min:{label:'Spin Min Reward',desc:'Minimum normal spin reward',type:'number',unit:'pts'},
 spin_reward_max:{label:'Spin Max Reward',desc:'Maximum normal spin reward',type:'number',unit:'pts'},
 spin_jackpot:{label:'Spin Jackpot',desc:'Jackpot reward',type:'number',unit:'pts'},
 spin_jackpot_chance:{label:'Jackpot Chance',desc:'Jackpot probability',type:'number',unit:'%'},
 points_per_referral:{label:'Referrer Reward',desc:'Reward for a valid referral',type:'number',unit:'pts'},
 referral_bonus_referred:{label:'New User Referral Bonus',desc:'Bonus for the referred user',type:'number',unit:'pts'},
 max_referral_bonus:{label:'Max Referral Bonus',desc:'Maximum cumulative referral bonus',type:'number',unit:'pts'},
 game_daily_limit:{label:'Games per Day',desc:'Default daily attempt limit for Dice/Lucky Box/Card Flip/Number Guess',type:'number'},
 tower_daily_limit:{label:'Tower Runs per Day',desc:'Daily Tower Climb limit',type:'number'},
 tower_max_reward:{label:'Tower Max Reward',desc:'Maximum points allowed from one Tower run',type:'number',unit:'pts'},
 tower_reward_multiplier:{label:'Tower Multiplier',desc:'Multiplier applied to Tower reward',type:'number',unit:'x'},
 dice_reward_enabled:{label:'Dice Rewards',desc:'Enable or disable Dice reward payouts',type:'toggle'},
 cardflip_reward_enabled:{label:'Card Flip Rewards',desc:'Enable or disable Card Flip payouts',type:'toggle'},
 numberguess_reward_enabled:{label:'Number Guess Rewards',desc:'Enable or disable Number Guess payouts',type:'toggle'},
 luckybox_reward_enabled:{label:'Lucky Box Rewards',desc:'Enable or disable Lucky Box payouts',type:'toggle'},
 withdrawal_enabled:{label:'Withdrawals Enabled',desc:'Master withdrawal switch',type:'toggle'},
 min_withdrawal_points:{label:'Minimum Withdrawal',desc:'Minimum points needed to withdraw',type:'number',unit:'pts'},
 max_pending_withdrawals:{label:'Max Pending Withdrawals',desc:'Maximum pending requests per user',type:'number'},
 max_daily_withdrawals:{label:'Withdrawals per Day',desc:'Maximum withdrawal requests per day',type:'number'},
 required_daily_ads:{label:'Required Ads to Withdraw',desc:'Ads user must watch today before withdrawal',type:'number'},
 stars_conversion_rate:{label:'Stars Rate',desc:'Points conversion rate for Telegram Stars',type:'number'},
 usdt_conversion_rate:{label:'USDT Rate',desc:'Points required per 1 USDT',type:'number',unit:'pts/$'},
 ton_conversion_rate:{label:'TON Rate',desc:'Points required per 1 TON',type:'number',unit:'pts/TON'},
 leaderboard_refresh_seconds:{label:'Leaderboard Refresh',desc:'Leaderboard refresh interval',type:'number',unit:'sec'},
 leaderboard_max_entries:{label:'Leaderboard Rows',desc:'Maximum leaderboard entries',type:'number'},
 contest_max_winners:{label:'Contest Max Winners',desc:'Maximum winners supported by contests',type:'number'},
 promo_default_reward:{label:'Default Promo Reward',desc:'Default reward when creating promo codes',type:'number',unit:'pts'},
 promo_default_max_claims:{label:'Default Promo Claims',desc:'Default maximum promo claims',type:'number'},
 maintenance_mode:{label:'Maintenance Mode',desc:'Disable normal app usage during maintenance',type:'toggle'},
 bot_name:{label:'Bot Name',desc:'Public bot/app display name',type:'text'},
 app_version:{label:'App Version',desc:'Displayed app version',type:'text'},
 support_username:{label:'Support Username',desc:'Telegram support username',type:'text'},
 channel_username:{label:'Channel Username',desc:'Main Telegram channel username',type:'text'},
};

const css=`.as2{font-family:system-ui,sans-serif;color:#fff}.as2-top{padding:12px 14px;border:1px solid rgba(74,222,128,.24);background:rgba(74,222,128,.07);border-radius:14px;margin-bottom:12px;font-size:12px;color:#86efac}.as2-search{width:100%;box-sizing:border-box;background:#0b0f19;border:1px solid rgba(255,255,255,.09);color:white;border-radius:13px;padding:12px 14px;margin-bottom:12px;outline:none}.as2-group{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:17px;margin-bottom:10px;overflow:hidden}.as2-gh{width:100%;display:flex;align-items:center;gap:10px;background:none;border:0;color:white;padding:14px;text-align:left}.as2-gi{font-size:20px}.as2-gt{font-weight:800;flex:1}.as2-count{font-size:10px;color:rgba(255,255,255,.35)}.as2-list{padding:0 10px 10px}.as2-row{background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.06);border-radius:13px;padding:11px;margin-top:7px}.as2-rh{display:flex;gap:8px;justify-content:space-between}.as2-label{font-size:13px;font-weight:750}.as2-desc{font-size:10px;color:rgba(255,255,255,.37);margin-top:2px}.as2-live{font-size:9px;color:#4ade80;white-space:nowrap}.as2-inputrow{display:flex;gap:7px;margin-top:9px}.as2-input{flex:1;min-width:0;background:#070a11;border:1px solid rgba(255,255,255,.1);color:white;border-radius:10px;padding:10px 11px;outline:none}.as2-input:focus{border-color:rgba(74,222,128,.45)}.as2-save{border:0;border-radius:10px;padding:0 12px;background:#22c55e;color:#031108;font-weight:850;font-size:11px}.as2-unit{font-size:9px;color:rgba(255,255,255,.34);margin-top:5px}.as2-toggle{margin-top:9px;width:100%;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:10px 12px;font-weight:800}.as2-on{background:rgba(74,222,128,.12);color:#4ade80}.as2-off{background:rgba(239,68,68,.1);color:#f87171}.as2-changed{border-color:rgba(250,204,21,.35)}`;

export default function AdminSettingsTab({settings,editSettings,setEditSettings,onSave,saving}:Props){
 const[q,setQ]=useState('');const[open,setOpen]=useState<Record<string,boolean>>({Ads:true,'Tap & Energy':true,Farm:true,'Daily Drop':true});
 const groups=useMemo(()=>GROUPS.map(g=>({...g,keys:g.keys.filter(k=>{const m=M[k];const s=(m?.label+' '+m?.desc+' '+k).toLowerCase();return !q||s.includes(q.toLowerCase())})})).filter(g=>g.keys.length),[q]);
 const change=(k:string,v:string)=>setEditSettings(p=>({...p,[k]:v}));
 const save=(k:string)=>{if(String(editSettings[k]??'')!==String(settings[k]??''))onSave(k)};
 return <div className="as2"><style>{css}</style><div className="as2-top">🟢 LIVE DATABASE MODE — values are saved to Supabase and reloaded after confirmation.</div><input className="as2-search" value={q} onChange={e=>setQ(e.target.value)} placeholder="Search settings…"/>{groups.map(g=><div className="as2-group" key={g.title}><button className="as2-gh" onClick={()=>setOpen(p=>({...p,[g.title]:!p[g.title]}))}><span className="as2-gi">{g.icon}</span><span className="as2-gt">{g.title}</span><span className="as2-count">{g.keys.length} SETTINGS · {open[g.title]?'▲':'▼'}</span></button>{open[g.title]&&<div className="as2-list">{g.keys.map(k=>{const m=M[k];if(!m)return null;const value=String(editSettings[k]??settings[k]??'');const changed=value!==String(settings[k]??'');const isOn=!['false','0','off','no',''].includes(value.toLowerCase());return <div className={`as2-row ${changed?'as2-changed':''}`} key={k}><div className="as2-rh"><div><div className="as2-label">{m.label}</div><div className="as2-desc">{m.desc}</div></div><div className="as2-live">DB: {settings[k]??'—'}</div></div>{m.type==='toggle'?<button className={`as2-toggle ${isOn?'as2-on':'as2-off'}`} disabled={saving===k} onClick={()=>{change(k,isOn?'false':'true')}}>{isOn?'ON ✓':'OFF ✕'} {changed?'· SAVE BELOW':''}</button>:<div className="as2-inputrow"><input className="as2-input" type={m.type==='number'?'number':'text'} value={value} onChange={e=>change(k,e.target.value)} onBlur={()=>save(k)} onKeyDown={e=>{if(e.key==='Enter')(e.currentTarget as HTMLInputElement).blur()}}/><button className="as2-save" disabled={!changed||saving===k} onClick={()=>onSave(k)}>{saving===k?'…':'SAVE'}</button></div>}{m.type==='toggle'&&<div className="as2-inputrow"><button className="as2-save" disabled={!changed||saving===k} onClick={()=>onSave(k)}>{saving===k?'SAVING…':'SAVE TO DATABASE'}</button></div>}{m.unit&&<div className="as2-unit">Unit: {m.unit}</div>}</div>})}</div>}</div>)}</div>
}

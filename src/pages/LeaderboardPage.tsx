import React,{useCallback,useEffect,useState}from'react';
import{Coins,Eye,Medal,RefreshCw,Trophy,UserCircle2,UsersRound}from'lucide-react';
import{useApp}from'@/context/AppContext';
import{usePreferences}from'@/context/PreferencesContext';
import{getActiveContests,getAdLeaderboard,getInviteLeaderboard,getLeaderboard,type LeaderboardRow}from'@/lib/api';

type Tab='points'|'ads'|'invites';
type AdRange='today'|'yesterday'|'week';
type InviteRange='week'|'month'|'all';
type Row=LeaderboardRow&{id?:string;telegram_id?:number;first_name?:string|null;username?:string|null;photo_url?:string|null;points?:number;total_points?:number};

const CSS=`
.lv-root{padding:0 16px 116px;color:inherit}.lv-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;animation:lv-rise .4s ease-out both}.lv-kicker{font:700 9px 'Orbitron',sans-serif;letter-spacing:3px;opacity:.34;text-transform:uppercase}.lv-title{font:900 22px 'Orbitron',sans-serif;margin-top:3px}.lv-icon{width:42px;height:42px;border-radius:15px;display:grid;place-items:center;background:rgba(255,190,0,.08);border:1px solid rgba(255,190,0,.2);color:#ffd45c;animation:lv-float 3s ease-in-out infinite}.lv-tabs{display:flex;gap:5px;padding:4px;border-radius:15px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);margin-bottom:10px;animation:lv-rise .42s .05s ease-out both}.lv-tab{flex:1;border:0;border-radius:11px;padding:9px 5px;background:transparent;color:inherit;font:750 9px 'Orbitron',sans-serif;opacity:.45;transition:transform .18s,background .18s,color .18s}.lv-tab:active{transform:scale(.95)}.lv-tab.active{background:#ffd24d;color:#171006;opacity:1;box-shadow:0 6px 18px rgba(255,190,0,.16)}.lv-tab svg{width:13px;vertical-align:middle;margin-right:4px}.lv-ranges{display:flex;gap:7px;margin-bottom:12px;animation:lv-rise .35s ease-out both}.lv-range{flex:1;border-radius:12px;padding:8px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;font-size:10px;transition:transform .18s,border-color .18s,background .18s}.lv-range:active{transform:scale(.95)}.lv-range.active{border-color:rgba(34,211,238,.35);color:#67e8f9;background:rgba(34,211,238,.07)}.lv-contest{padding:12px;border-radius:16px;background:rgba(255,190,0,.06);border:1px solid rgba(255,190,0,.17);margin-bottom:10px;animation:lv-pulse 2.7s ease-in-out infinite}.lv-contest-title{font-weight:800;font-size:12px}.lv-contest-sub{font-size:10px;opacity:.45;margin-top:2px}.lv-row{display:flex;align-items:center;gap:11px;padding:11px 12px;margin-bottom:7px;border-radius:17px;background:linear-gradient(145deg,rgba(255,255,255,.08),rgba(255,255,255,.025)),rgba(10,15,27,.46);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(20px);animation:lv-rise .42s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--lv-index)*42ms);transition:transform .18s,border-color .18s}.lv-row:active{transform:scale(.985)}.lv-row.me{border-color:rgba(255,205,70,.35);box-shadow:0 0 22px rgba(255,190,0,.06)}.lv-row:nth-of-type(1) .lv-rank{color:#ffd45c}.lv-rank{width:31px;text-align:center;font:800 11px 'Orbitron',sans-serif}.lv-avatar{width:39px;height:39px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:rgba(255,255,255,.06)}.lv-avatar img{width:100%;height:100%;object-fit:cover}.lv-avatar svg{width:19px}.lv-body{flex:1;min-width:0}.lv-name{font-weight:800;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.lv-user{font-size:9px;opacity:.38}.lv-score{text-align:right}.lv-score b{display:block;font:800 12px 'Orbitron',sans-serif;color:#ffd45c}.lv-score span{font-size:8px;opacity:.42}.lv-empty,.lv-loading{text-align:center;padding:42px 0;opacity:.42;font:700 9px 'Orbitron',sans-serif;letter-spacing:2px}.lv-spin{animation:lv-spin 1s linear infinite}
@keyframes lv-spin{to{transform:rotate(360deg)}}@keyframes lv-rise{from{opacity:0;transform:translateY(11px) scale(.99)}to{opacity:1;transform:none}}@keyframes lv-float{50%{transform:translateY(-4px) rotate(4deg)}}@keyframes lv-pulse{50%{border-color:rgba(255,190,0,.34);box-shadow:0 0 22px rgba(255,190,0,.08)}}
[data-theme='light'] .lv-tabs,[data-theme='light'] .lv-range,[data-theme='light'] .lv-row,[data-theme='light'] .lv-contest{background:rgba(255,255,255,.9);border-color:rgba(15,23,42,.09);color:#0f172a;box-shadow:0 10px 28px rgba(45,60,90,.06)}[data-theme='light'] .lv-tab{color:#334155}[data-theme='light'] .lv-tab.active{color:#171006}[data-theme='light'] .lv-score b{color:#8a5a00}
@media(prefers-reduced-motion:reduce){.lv-root *{animation-duration:.01ms!important;animation-iteration-count:1!important}.lv-tab,.lv-range,.lv-row{transition:none}}
`;

export default function LeaderboardPage(){
 const{user}=useApp();
 const{t}=usePreferences();
 const[tab,setTab]=useState<Tab>('points');
 const[adRange,setAdRange]=useState<AdRange>('today');
 const[inviteRange,setInviteRange]=useState<InviteRange>('week');
 const[rows,setRows]=useState<Row[]>([]);
 const[contests,setContests]=useState<Array<{contest_type:string;title:string}>>([]);
 const[loading,setLoading]=useState(true);

 const load=useCallback(async()=>{
  setLoading(true);
  const ranking=tab==='points'?getLeaderboard():tab==='ads'?getAdLeaderboard(adRange):getInviteLeaderboard(inviteRange);
  const[data,activeContests]=await Promise.all([ranking,getActiveContests()]);
  setRows((data||[]) as Row[]);
  setContests(activeContests||[]);
  setLoading(false);
 },[tab,adRange,inviteRange]);

 useEffect(()=>{
  void load();
  const timer=window.setInterval(()=>void load(),30_000);
  return()=>window.clearInterval(timer);
 },[load]);

 const activeContest=tab==='ads'?contests.find(contest=>contest.contest_type==='ads_watch'):null;
 const tabItems=[{id:'points' as const,label:t('points'),Icon:Coins},{id:'ads' as const,label:t('ads'),Icon:Eye},{id:'invites' as const,label:t('invites'),Icon:UsersRound}];

 return <><style>{CSS}</style><div className="lv-root">
  <div className="lv-head"><div><div className="lv-kicker">{t('competeRank')}</div><div className="lv-title">{t('leaderboard')}</div></div><div className="lv-icon"><Trophy/></div></div>
  <div className="lv-tabs">{tabItems.map(({id,label,Icon})=><button key={id} className={`lv-tab ${tab===id?'active':''}`} onClick={()=>setTab(id)} aria-pressed={tab===id}><Icon/>{label}</button>)}</div>
  {tab==='ads'?<div className="lv-ranges">{(['today','yesterday','week'] as AdRange[]).map(range=><button key={range} className={`lv-range ${adRange===range?'active':''}`} onClick={()=>setAdRange(range)}>{t(range==='week'?'sevenDays':range)}</button>)}</div>:null}
  {tab==='invites'?<div className="lv-ranges">{(['week','month','all'] as InviteRange[]).map(range=><button key={range} className={`lv-range ${inviteRange===range?'active':''}`} onClick={()=>setInviteRange(range)}>{t(range==='week'?'weekly':range==='month'?'monthly':'allTime')}</button>)}</div>:null}
  {activeContest?<div className="lv-contest"><div className="lv-contest-title"><Medal style={{width:15,verticalAlign:'middle',marginRight:5}}/>{activeContest.title}</div><div className="lv-contest-sub">{t('contestLive')}</div></div>:null}
  {loading?<div className="lv-loading"><RefreshCw className="lv-spin" style={{width:19,margin:'0 auto 8px'}}/>{t('loading')}</div>:rows.length===0?<div className="lv-empty">{t('noLeaderboardData')}</div>:rows.map((row,index)=>{const profile=tab==='points'?row:tab==='ads'?(row.users||{}):(row.user||{});const telegramId=profile.telegram_id;const isMe=Boolean(user&&telegramId===user.telegram_id);const score=tab==='points'?Number(row.points??row.total_points??0):Number(row.score??0);const scoreLabel=tab==='points'?t('points'):tab==='ads'?t('ads'):t('invites');return <div className={`lv-row ${isMe?'me':''}`} style={{'--lv-index':index} as React.CSSProperties} key={row.user_id||row.id||index}><div className="lv-rank">#{row.rank||index+1}</div><div className="lv-avatar">{profile.photo_url?<img src={profile.photo_url} alt=""/>:<UserCircle2/>}</div><div className="lv-body"><div className="lv-name">{profile.first_name||profile.username||t('user')}{isMe?` · ${t('you')}`:''}</div><div className="lv-user">{profile.username?`@${profile.username}`:`UID ${telegramId||'—'}`}</div></div><div className="lv-score"><b>{score.toLocaleString()}</b><span>{scoreLabel}</span></div></div>})}
 </div></>;
}

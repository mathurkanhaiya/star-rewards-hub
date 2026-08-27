import React,{useCallback,useEffect,useMemo,useState}from'react';
import{CalendarDays,CheckCircle2,ChevronRight,Gift,Globe2,ListChecks,LoaderCircle,PlayCircle,Send,UsersRound,XCircle}from'lucide-react';
import{useApp}from'@/context/AppContext';import{usePreferences}from'@/context/PreferencesContext';import{getTasks,getUserTasks,completeTask}from'@/lib/api';import{Task}from'@/types/telegram';
import AdsgramTask from'@/components/AdsgramTask';
import{getTaskProfileImage}from'@/lib/taskProfile';
function haptic(type:'impact'|'success'|'error'='impact'){const feedback=window.Telegram?.WebApp?.HapticFeedback;if(type==='impact')feedback?.impactOccurred('medium');else feedback?.notificationOccurred(type)}
const TYPE:Record<string,{key:string;color:string;Icon:React.ComponentType<{className?:string}>}>={social:{key:'social',color:'#22d3ee',Icon:Send},daily:{key:'daily',color:'#fbbf24',Icon:CalendarDays},referral:{key:'referral',color:'#4ade80',Icon:UsersRound},video:{key:'video',color:'#a855f7',Icon:PlayCircle},special:{key:'special',color:'#fb7185',Icon:Gift}};
function TaskProfileImage({task,Icon}:{task:Task;Icon:React.ComponentType<{className?:string}>}){const source=getTaskProfileImage(task);const[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[source]);return source&&!failed?<img src={source} alt={`${task.title} profile`} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:<Icon/>}
const CSS=`.tk-root{padding:0 16px 112px;color:inherit}.tk-head{display:flex;align-items:flex-end;justify-content:space-between;margin:3px 0 15px;animation:tk-rise .42s ease-out both}.tk-kicker{font:700 9px 'Orbitron',sans-serif;letter-spacing:3px;opacity:.34;text-transform:uppercase}.tk-title{font:900 23px 'Orbitron',sans-serif;margin-top:4px}.tk-head-icon{width:45px;height:45px;border-radius:15px;display:grid;place-items:center;background:rgba(255,216,77,.08);border:1px solid rgba(255,216,77,.18);color:#ffd84d;animation:tk-float 3s ease-in-out infinite}.tk-head-icon svg{width:21px}.tk-sponsored{margin-bottom:13px}.tk-filters{display:flex;gap:7px;overflow:auto;padding:1px 0 12px;scrollbar-width:none;animation:tk-rise .42s .05s ease-out both}.tk-filters::-webkit-scrollbar{display:none}.tk-filter{flex:0 0 auto;padding:8px 12px;border-radius:13px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.035);color:inherit;font-size:10px;font-weight:750;transition:transform .18s,background .18s,color .18s}.tk-filter:active{transform:scale(.94)}.tk-filter.active{color:#171006;background:#ffd84d;border-color:#ffd84d}.tk-summary{display:flex;justify-content:space-between;align-items:center;margin:3px 2px 9px;font-size:10px}.tk-summary span:first-child{font:700 9px 'Orbitron',sans-serif;letter-spacing:1.5px;opacity:.4;text-transform:uppercase}.tk-summary b{color:#67e8f9}.tk-list{display:grid;gap:9px}.tk-card{position:relative;overflow:hidden;border-radius:21px;padding:14px;background:linear-gradient(145deg,rgba(255,255,255,.1),rgba(255,255,255,.025)),rgba(10,15,27,.5);border:1px solid rgba(255,255,255,.09);box-shadow:inset 0 1px rgba(255,255,255,.13),0 12px 30px rgba(0,0,0,.17);backdrop-filter:blur(22px);animation:tk-rise .45s cubic-bezier(.2,.8,.2,1) both;animation-delay:calc(var(--tk-index)*45ms);transition:transform .18s,border-color .18s}.tk-card:active{transform:scale(.985)}.tk-row{display:flex;align-items:center;gap:12px}.tk-icon{width:50px;height:50px;border-radius:15px;display:grid;place-items:center;flex:0 0 50px;overflow:hidden;animation:tk-icon 2.8s ease-in-out infinite}.tk-icon svg{width:23px}.tk-icon img{width:100%;height:100%;object-fit:cover;transform:scale(1.02);animation:tk-avatar 4s ease-in-out infinite}.tk-body{min-width:0;flex:1}.tk-tag{font-size:8px;font-weight:850;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:3px}.tk-name{font-size:14px;font-weight:850;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.tk-desc{font-size:10px;opacity:.43;margin-top:2px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tk-reward{font:750 10px 'Orbitron',sans-serif;margin-top:6px}.tk-go{width:38px;height:38px;border-radius:13px;border:0;display:grid;place-items:center;color:#071016;flex:0 0 38px;transition:transform .18s,filter .18s}.tk-go:active:not(:disabled){transform:scale(.88)}.tk-go svg{width:18px}.tk-go:disabled{opacity:.45}.tk-msg{display:flex;align-items:center;gap:6px;margin-top:10px;padding:9px 10px;border-radius:12px;font-size:10px;animation:tk-pop .22s ease-out}.tk-msg svg{width:14px}.tk-msg.ok{color:#86efac;background:rgba(74,222,128,.08)}.tk-msg.err{color:#fca5a5;background:rgba(239,68,68,.08)}.tk-empty,.tk-loading{padding:38px 10px;text-align:center;border-radius:20px;border:1px dashed rgba(255,255,255,.09);opacity:.48}.tk-empty svg,.tk-loading svg{width:28px;margin:0 auto 9px}.tk-loading svg{animation:tkspin 1s linear infinite}@keyframes tkspin{to{transform:rotate(360deg)}}@keyframes tk-rise{from{opacity:0;transform:translateY(12px) scale(.99)}to{opacity:1;transform:none}}@keyframes tk-float{50%{transform:translateY(-4px) rotate(4deg)}}@keyframes tk-icon{50%{transform:translateY(-2px)}}@keyframes tk-avatar{50%{transform:scale(1.08)}}@keyframes tk-pop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:none}}[data-theme='light'] .tk-card{background:rgba(255,255,255,.92);border-color:rgba(15,23,42,.08);box-shadow:0 12px 28px rgba(45,60,90,.07);color:#0f172a}[data-theme='light'] .tk-filter{background:rgba(255,255,255,.82);border-color:rgba(15,23,42,.08);color:#334155}[data-theme='light'] .tk-filter.active{background:#f6c949;color:#2b2105}[data-theme='light'] .tk-empty,[data-theme='light'] .tk-loading{border-color:rgba(15,23,42,.1);color:#475569}@media(prefers-reduced-motion:reduce){.tk-root *{animation-duration:.01ms!important;animation-iteration-count:1!important}.tk-card,.tk-filter,.tk-go{transition:none}}`;
export default function TasksPage(){
 const{user,refreshBalance}=useApp();
 const{t}=usePreferences();
 const[tasks,setTasks]=useState<Task[]>([]);
 const[completing,setCompleting]=useState<string|null>(null);
 const[message,setMessage]=useState<{id:string;text:string;success:boolean}|null>(null);
 const[filter,setFilter]=useState('all');
 const[loading,setLoading]=useState(true);

 const load=useCallback(async()=>{
  if(!user)return;
  setLoading(true);
  const[all,userTasks]=await Promise.all([getTasks(),getUserTasks(user.id)]);
  const ids=new Set((userTasks as Array<{task_id:string}>).map(item=>item.task_id));
  setTasks(all.filter(task=>task.is_repeatable||!ids.has(task.id)).sort((a,b)=>b.reward_points-a.reward_points));
  setLoading(false);
 },[user]);

 useEffect(()=>{
  void load();
  const timer=window.setInterval(()=>void load(),30_000);
  return()=>window.clearInterval(timer);
 },[load]);

 async function complete(task:Task){
  if(!user||completing)return;
  haptic();
  setCompleting(task.id);
  try{
   if(task.link){
    const telegram=window.Telegram?.WebApp;
    if(telegram?.openTelegramLink&&task.link.includes('t.me'))telegram.openTelegramLink(task.link);
    else if(telegram?.openLink)telegram.openLink(task.link);
    else window.open(task.link,'_blank');
   }
   const result=await completeTask(user.id,task.id);
   if(!result.success)throw new Error(result.message||t('taskFailed'));
   haptic('success');
   setMessage({id:task.id,text:`+${result.points||task.reward_points} ${t('points')}`,success:true});
   setTasks(current=>current.filter(item=>item.id!==task.id));
   await refreshBalance();
  }catch(error){
   haptic('error');
   setMessage({id:task.id,text:error instanceof Error?error.message:t('taskFailed'),success:false});
  }
  setCompleting(null);
  window.setTimeout(()=>setMessage(null),2800);
 }

 const shown=useMemo(()=>filter==='all'?tasks:tasks.filter(task=>task.task_type===filter),[tasks,filter]);
 const filters=['all','social','daily','referral','video','special'];

 return <><style>{CSS}</style><div className="tk-root">
  <div className="tk-head"><div><div className="tk-kicker">{t('earnComplete')}</div><div className="tk-title">{t('taskBoard')}</div></div><div className="tk-head-icon"><ListChecks/></div></div>
  <div className="tk-sponsored"><AdsgramTask blockId="task-44758" rewardAmount={10}/></div>
  <div className="tk-filters">{filters.map(item=><button key={item} className={`tk-filter ${filter===item?'active':''}`} onClick={()=>{haptic();setFilter(item)}}>{t(item)}</button>)}</div>
  {!loading?<div className="tk-summary"><span>{t('tasksAvailable')}</span><b>{shown.length}</b></div>:null}
  {loading?<div className="tk-loading"><LoaderCircle/><div>{t('loadingTasks')}</div></div>:shown.length===0?<div className="tk-empty"><CheckCircle2/><div>{t('allTasksCompleted')}</div></div>:<div className="tk-list">{shown.map((task,index)=>{const config=TYPE[task.task_type]||{key:'tasks',color:'#67e8f9',Icon:Globe2};const Icon=config.Icon;return <div className="tk-card" style={{'--tk-index':index} as React.CSSProperties} key={task.id}><div className="tk-row"><div className="tk-icon" style={{color:config.color,background:`${config.color}14`,border:`1px solid ${config.color}28`}}><TaskProfileImage task={task} Icon={Icon}/></div><div className="tk-body"><div className="tk-tag" style={{color:config.color}}>{t(config.key)}</div><div className="tk-name">{task.title}</div>{task.description?<div className="tk-desc">{task.description}</div>:null}<div className="tk-reward" style={{color:config.color}}>+{task.reward_points.toLocaleString()} {t('points')}</div></div><button className="tk-go" disabled={completing===task.id} onClick={()=>void complete(task)} style={{background:config.color}}>{completing===task.id?<LoaderCircle/>:<ChevronRight/>}</button></div>{message?.id===task.id?<div className={`tk-msg ${message.success?'ok':'err'}`}>{message.success?<CheckCircle2/>:<XCircle/>}{message.text}</div>:null}</div>})}</div>}
 </div></>;
}

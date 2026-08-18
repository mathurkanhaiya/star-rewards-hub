import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import {
  adminGetStats, adminGetUsers, adminGetWithdrawals, adminUpdateWithdrawal,
  adminUpdateSetting, adminBanUser, adminToggleTask, adminCreateTask,
  adminDeleteTask, adminAdjustBalance, adminGetContests, adminCreateContest,
  adminEndContest, adminSendBroadcast, getTasks, getSettings,
} from '@/lib/api';
import { Task, Contest } from '@/types/telegram';
import AdminUsersTab from '@/components/admin/AdminUsersTab';
import AdminWithdrawalsTab from '@/components/admin/AdminWithdrawalsTab';
import AdminTasksTab from '@/components/admin/AdminTasksTab';
import AdminSettingsTab from '@/components/admin/AdminSettingsTab';
import AdminContestsTab from '@/components/admin/AdminContestsTab';
import AdminPromosTab from '@/components/admin/AdminPromosTab';

type Tab='dashboard'|'users'|'withdrawals'|'tasks'|'contests'|'promos'|'broadcast'|'settings';

const tabs:[Tab,string,string][]=[
  ['dashboard','Stats','📊'],['users','Users','👥'],['withdrawals','Withdraw','💸'],
  ['tasks','Tasks','📋'],['contests','Contests','🏆'],['promos','Promos','🎁'],
  ['broadcast','Broadcast','📢'],['settings','Settings','⚙️'],
];

export default function AdminPanel(){
  const {telegramUser,refreshUser}=useApp();
  const [tab,setTab]=useState<Tab>('dashboard');
  const [loading,setLoading]=useState(true);
  const [message,setMessage]=useState('');
  const [stats,setStats]=useState<any>({});
  const [users,setUsers]=useState<any[]>([]);
  const [withdrawals,setWithdrawals]=useState<any[]>([]);
  const [tasks,setTasks]=useState<Task[]>([]);
  const [contests,setContests]=useState<Contest[]>([]);
  const [settings,setSettings]=useState<Record<string,string>>({});
  const [editSettings,setEditSettings]=useState<Record<string,string>>({});
  const [broadcast,setBroadcast]=useState('');
  const [sending,setSending]=useState(false);

  async function load(){
    setLoading(true);
    const [s,u,w,t,c,st]=await Promise.all([
      adminGetStats(),adminGetUsers(),adminGetWithdrawals(),getTasks(),adminGetContests(),getSettings()
    ]);
    setStats(s||{});setUsers(u||[]);setWithdrawals(w||[]);setTasks(t||[]);setContests(c||[]);
    setSettings(st||{});setEditSettings(st||{});setLoading(false);
  }
  useEffect(()=>{load();},[]);
  function toast(v:string){setMessage(v);setTimeout(()=>setMessage(''),2800);}

  const cards=[
    ['Total Users',stats.totalUsers||0,'👥'],['Active Today',stats.activeUsersToday||0,'🟢'],
    ['Ad Views',stats.totalAdViews||0,'🎬'],['Transactions',stats.totalTransactions||0,'📊'],
    ['Withdrawals',stats.totalWithdrawals||0,'💸'],['Pending',stats.pendingWithdrawals||0,'⏳'],
    ['Active Tasks',stats.activeTasks??tasks.filter(x=>x.is_active).length,'✅'],['Total Tasks',stats.totalTasks??tasks.length,'📋'],
    ['Task Rewards',stats.totalTaskRewards||0,'🎯'],['Points Earned',stats.totalPointsEarned||0,'🪙'],
    ['Circulating',stats.circulatingPoints||0,'💰'],['Ad Reward',Number(settings.ad_reward_points||0),'⚡'],
  ];

  return <div className="ap-root">
    <style>{`
      .ap-root{min-height:100vh;background:#080b14;color:#fff;padding:18px 14px 110px;font-family:Arial,sans-serif}.ap-head{display:flex;align-items:center;gap:11px;margin-bottom:15px}.ap-logo{width:45px;height:45px;border-radius:14px;background:#ef444420;border:1px solid #ef444455;display:flex;align-items:center;justify-content:center;font-size:23px}.ap-title{font-size:21px;font-weight:900}.ap-sub{font-size:10px;color:#ffffff55;letter-spacing:2px}.ap-tabs{display:flex;gap:6px;overflow:auto;margin-bottom:14px}.ap-tab{white-space:nowrap;border:1px solid #ffffff14;background:#ffffff08;color:#ffffff88;border-radius:999px;padding:8px 11px}.ap-tab.on{color:#fff;border-color:#ef444466;background:#ef444418}.ap-msg{padding:10px 12px;border-radius:12px;margin-bottom:10px;background:#22c55e18;border:1px solid #22c55e44;color:#86efac}.ap-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.ap-card{padding:14px;border-radius:16px;background:#ffffff08;border:1px solid #ffffff10}.ap-icon{font-size:20px}.ap-val{font-size:22px;font-weight:900;margin-top:7px}.ap-label{font-size:10px;color:#ffffff66;margin-top:3px;text-transform:uppercase;letter-spacing:1px}.ap-section{margin:17px 0 9px;color:#ffffff66;font-size:10px;letter-spacing:2px;text-transform:uppercase}.ap-text{width:100%;box-sizing:border-box;border-radius:14px;background:#ffffff08;border:1px solid #ffffff18;color:white;padding:13px;min-height:120px}.ap-send{width:100%;margin-top:9px;padding:13px;border:none;border-radius:13px;background:#ec4899;color:white;font-weight:800}.ap-loading{text-align:center;padding:50px 0;color:#ffffff66}
    `}</style>
    <div className="ap-head"><div className="ap-logo">🛡️</div><div><div className="ap-title">Admin Control</div><div className="ap-sub">LIVE BACKEND V2</div></div></div>
    {message&&<div className="ap-msg">{message}</div>}
    <div className="ap-tabs">{tabs.map(([id,label,icon])=><button key={id} className={`ap-tab ${tab===id?'on':''}`} onClick={()=>setTab(id)}>{icon} {label}</button>)}</div>
    {loading?<div className="ap-loading">Loading live admin data…</div>:<>
      {tab==='dashboard'&&<><div className="ap-grid">{cards.map(([label,val,icon])=><div className="ap-card" key={String(label)}><div className="ap-icon">{icon}</div><div className="ap-val">{Number(val||0).toLocaleString()}</div><div className="ap-label">{label}</div></div>)}</div></>}
      {tab==='users'&&<AdminUsersTab users={users} onBan={async(id,banned)=>{const r:any=await adminBanUser(id,banned);toast(r.success?'User updated':r.message||'Failed');await load();}} onAdjustBalance={async(id,pts,reason)=>{const r:any=await adminAdjustBalance(id,pts,reason);toast(r.success?'Balance updated':r.message||'Failed');await load();}}/>}
      {tab==='withdrawals'&&<AdminWithdrawalsTab withdrawals={withdrawals} onApprove={async id=>{const r:any=await adminUpdateWithdrawal(id,'approved');toast(r.success?'Approved':r.message||'Failed');await load();}} onReject={async id=>{const r:any=await adminUpdateWithdrawal(id,'rejected','Rejected by admin');toast(r.success?'Rejected':r.message||'Failed');await load();}}/>}
      {tab==='tasks'&&<AdminTasksTab tasks={tasks} onToggle={async(id,active)=>{const r:any=await adminToggleTask(id,active);toast(r.success?'Task updated':r.message||'Failed');await load();}} onDelete={async id=>{const r:any=await adminDeleteTask(id);toast(r.success?'Task deleted':r.message||'Failed');await load();}} onCreate={async task=>{const r:any=await adminCreateTask(task);toast(r.success?'Task created ✓':r.message||'Failed');await load();}}/>}
      {tab==='contests'&&<AdminContestsTab contests={contests} onCreateContest={async contest=>{const r:any=await adminCreateContest(contest);toast(r.success?'Contest created':r.message||'Failed');await load();}} onEndContest={async id=>{const r:any=await adminEndContest(id);toast(r.success?'Contest rewards sent':r.message||'Failed');await load();}}/>}
      {tab==='promos'&&<AdminPromosTab onMessage={toast}/>} 
      {tab==='broadcast'&&<><div className="ap-section">Broadcast message</div><textarea className="ap-text" value={broadcast} onChange={e=>setBroadcast(e.target.value)} placeholder="Message to all users"/><button className="ap-send" disabled={sending||!broadcast.trim()} onClick={async()=>{if(!telegramUser)return;setSending(true);const r:any=await adminSendBroadcast(broadcast,telegramUser.id);toast(r.success?'Broadcast sent':r.message||'Failed');if(r.success)setBroadcast('');setSending(false);}}>📢 {sending?'Sending…':'Send Broadcast'}</button></>}
      {tab==='settings'&&<AdminSettingsTab settings={settings} editSettings={editSettings} setEditSettings={setEditSettings} saving={null} onSave={async key=>{const r:any=await adminUpdateSetting(key,editSettings[key]);if(r.success){toast(`${key} saved ✓`);await refreshUser();await load();}else toast(r.message||'Failed');}}/>}
    </>}
  </div>;
}

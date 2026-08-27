import { useEffect, useState } from 'react';
import { adminCreateMandatoryChannel, adminDeleteMandatoryChannel, adminListMandatoryChannels, adminUpdateMandatoryChannel, type AdminMandatoryChannel } from '@/lib/mandatoryJoinApi';

const CSS=`
.mc-wrap{display:grid;gap:12px}.mc-form,.mc-card{padding:14px;border-radius:16px;background:#ffffff08;border:1px solid #ffffff12}.mc-title{font-size:13px;font-weight:900;margin-bottom:10px}.mc-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}.mc-input{width:100%;box-sizing:border-box;border-radius:11px;background:#ffffff08;border:1px solid #ffffff16;color:#fff;padding:10px;font-size:12px}.mc-full{grid-column:1/-1}.mc-btn{border:0;border-radius:11px;padding:10px 12px;font-weight:800}.mc-save{background:#22c55e;color:#07130b}.mc-del{background:#ef444422;color:#fca5a5;border:1px solid #ef444444}.mc-toggle{background:#ffffff0a;color:#fff;border:1px solid #ffffff16}.mc-row{display:flex;align-items:center;gap:10px}.mc-main{flex:1;min-width:0}.mc-name{font-weight:850;font-size:13px}.mc-meta{font-size:10px;color:#ffffff66;margin-top:3px;word-break:break-all}.mc-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}.mc-empty{padding:24px;text-align:center;color:#ffffff66;border:1px dashed #ffffff18;border-radius:14px}
`;

export default function AdminMandatoryChannelsTab({onMessage}:{onMessage:(m:string)=>void}){
 const[channels,setChannels]=useState<AdminMandatoryChannel[]>([]);const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);
 const[form,setForm]=useState({title:'',chatId:'',username:'',joinUrl:'',imageUrl:'',sortOrder:'0'});
 const load=async()=>{setLoading(true);setChannels(await adminListMandatoryChannels());setLoading(false)};
 useEffect(()=>{void load()},[]);
 const create=async()=>{if(!form.title.trim()||!form.chatId.trim()||!form.joinUrl.trim()){onMessage('Title, chat ID and join URL are required');return}setSaving(true);const r=await adminCreateMandatoryChannel({title:form.title.trim(),chatId:form.chatId.trim(),username:form.username.trim(),joinUrl:form.joinUrl.trim(),imageUrl:form.imageUrl.trim(),sortOrder:Number(form.sortOrder)||0,isActive:true});setSaving(false);onMessage(r.success?'Mandatory channel added ✓':r.message||'Failed');if(r.success){setForm({title:'',chatId:'',username:'',joinUrl:'',imageUrl:'',sortOrder:'0'});await load()}};
 return <><style>{CSS}</style><div className="mc-wrap">
  <div className="mc-form"><div className="mc-title">Add mandatory channel</div><div className="mc-grid">
   <input className="mc-input mc-full" placeholder="Channel name" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/>
   <input className="mc-input" placeholder="@username or -100 chat ID" value={form.chatId} onChange={e=>setForm({...form,chatId:e.target.value})}/>
   <input className="mc-input" placeholder="Username (optional)" value={form.username} onChange={e=>setForm({...form,username:e.target.value})}/>
   <input className="mc-input mc-full" placeholder="Join link https://t.me/..." value={form.joinUrl} onChange={e=>setForm({...form,joinUrl:e.target.value})}/>
   <input className="mc-input mc-full" placeholder="Image URL (optional)" value={form.imageUrl} onChange={e=>setForm({...form,imageUrl:e.target.value})}/>
   <input className="mc-input" type="number" placeholder="Sort order" value={form.sortOrder} onChange={e=>setForm({...form,sortOrder:e.target.value})}/>
   <button className="mc-btn mc-save" disabled={saving} onClick={()=>void create()}>{saving?'Saving…':'Add channel'}</button>
  </div></div>
  {loading?<div className="mc-empty">Loading channels…</div>:channels.length===0?<div className="mc-empty">No mandatory channels configured.</div>:channels.map(ch=><div className="mc-card" key={ch.id}><div className="mc-row"><div className="mc-main"><div className="mc-name">{ch.title}</div><div className="mc-meta">{ch.chat_id} · {ch.is_active?'Active':'Disabled'}</div></div></div><div className="mc-actions"><button className="mc-btn mc-toggle" onClick={async()=>{const r=await adminUpdateMandatoryChannel(ch.id,{isActive:!ch.is_active});onMessage(r.success?'Channel updated ✓':r.message||'Failed');if(r.success)await load()}}>{ch.is_active?'Disable':'Enable'}</button><button className="mc-btn mc-del" onClick={async()=>{if(!window.confirm(`Delete ${ch.title}?`))return;const r=await adminDeleteMandatoryChannel(ch.id);onMessage(r.success?'Channel deleted':r.message||'Failed');if(r.success)await load()}}>Delete</button></div></div>)}
 </div></>;
}

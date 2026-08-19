import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireTelegramUser, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

function response(success:boolean,message:string,status=200,extra:Record<string,unknown>={}){return new Response(JSON.stringify({success,message,...extra}),{status,headers:{...corsHeaders,'Content-Type':'application/json'}})}
const num=(v:unknown,f:number)=>{const n=Number(v);return Number.isFinite(n)&&n>0?n:f};

serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:corsHeaders});
 try{
  const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {appUser}=await requireTelegramUser(req,supabase); const userId=appUser.id;
  const {method,points,walletAddress}=await req.json();
  if(!['ton','usdt_polygon','upi'].includes(method))return response(false,'Invalid withdrawal method');
  if(!Number.isInteger(points)||points<=0)return response(false,'Invalid points');
  const address=String(walletAddress||'').trim(); if(!address||address.length>256)return response(false,'Wallet/UPI address is required');
  if(method==='ton'&&!/^(UQ|EQ)[A-Za-z0-9_-]{46,}$/.test(address))return response(false,'Invalid TON/GRAM wallet address format');
  if(method==='usdt_polygon'&&!/^0x[a-fA-F0-9]{40}$/.test(address))return response(false,'Invalid Polygon wallet address');
  if(method==='upi'&&!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(address))return response(false,'Invalid UPI ID format');

  const {data:settings}=await supabase.from('settings').select('key,value'); const map=Object.fromEntries((settings||[]).map((s:any)=>[s.key,s.value]));
  if(String(map.withdrawal_enabled??'true').toLowerCase()==='false')return response(false,'Withdrawals are temporarily disabled');
  const minPoints=Math.max(1,Math.floor(num(map.min_withdrawal_points,5000))); if(points<minPoints)return response(false,`Minimum withdrawal is ${minPoints.toLocaleString()} points`);
  const requiredAds=Math.max(0,Math.floor(Number(map.required_daily_ads??15)||0));
  if(requiredAds>0){const d=new Date();d.setUTCHours(0,0,0,0);const {count}=await supabase.from('ad_logs').select('id',{count:'exact',head:true}).eq('user_id',userId).gte('created_at',d.toISOString());if((count||0)<requiredAds)return response(false,`Watch ${requiredAds-(count||0)} more ads today`);}

  const tonRate=num(map.ton_conversion_rate,100000); const usdtRate=num(map.usdt_conversion_rate,15000); const inrRate=num(map.inr_conversion_rate,1000);
  const rate=method==='ton'?tonRate:method==='usdt_polygon'?usdtRate:inrRate;
  const decimals=method==='ton'?6:method==='usdt_polygon'?4:2; const amount=Number((points/rate).toFixed(decimals)); if(amount<=0)return response(false,'Invalid withdrawal amount');

  const {data:balance}=await supabase.from('balances').select('points,total_withdrawn').eq('user_id',userId).single(); if(!balance)return response(false,'Balance not found'); if(Number(balance.points)<points)return response(false,'Insufficient balance');
  const d=new Date();d.setUTCHours(0,0,0,0);
  const [{count:pendingCount},{count:todayCount}]=await Promise.all([
   supabase.from('withdrawals').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('status','pending'),
   supabase.from('withdrawals').select('id',{count:'exact',head:true}).eq('user_id',userId).gte('created_at',d.toISOString())
  ]);
  if((pendingCount||0)>=Math.max(1,Math.floor(num(map.max_pending_withdrawals,2))))return response(false,'Too many pending withdrawals');
  if((todayCount||0)>=Math.max(1,Math.floor(num(map.max_daily_withdrawals,3))))return response(false,'Daily withdrawal limit reached');

  const oldPoints=Number(balance.points),oldTotal=Number(balance.total_withdrawn||0),newPoints=oldPoints-points;
  const {data:deducted,error:deductError}=await supabase.from('balances').update({points:newPoints,total_withdrawn:oldTotal+points}).eq('user_id',userId).eq('points',balance.points).select('points').maybeSingle();
  if(deductError||!deducted)return response(false,'Balance changed. Please try again.');
  const {data:withdrawal,error:withdrawError}=await supabase.from('withdrawals').insert({user_id:userId,method,points_spent:points,amount,wallet_address:address,status:'pending'}).select('id').single();
  if(withdrawError||!withdrawal){await supabase.from('balances').update({points:oldPoints,total_withdrawn:oldTotal}).eq('user_id',userId).eq('points',newPoints);return response(false,'Failed to create withdrawal');}
  const amountStr=method==='ton'?`${amount} TON (GRAM)`:method==='usdt_polygon'?`${amount} USDT · Polygon`:`₹${amount} INR`;
  await Promise.all([
   supabase.from('transactions').insert({user_id:userId,type:'spend',points:-points,description:`💸 Withdrawal: ${amountStr}`,reference_id:withdrawal.id}),
   supabase.from('notifications').insert({user_id:userId,title:'💸 Withdrawal Submitted',message:`Your ${points.toLocaleString()} point withdrawal for ${amountStr} is pending review.`,type:'withdrawal'})
  ]);
  return response(true,'Withdrawal request submitted successfully!',200,{amount,method});
 }catch(error){const message=(error as Error).message;const status=/Telegram|registered|banned|expired|signature/i.test(message)?401:400;return response(false,message,status)}
});

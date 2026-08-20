import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.55.0";
import { verifyTelegramInitData, secureCorsHeaders as corsHeaders } from "../_shared/telegramAuth.ts";

async function resolveTelegramPhoto(supabase:any, botToken:string, telegramId:number):Promise<string|null>{
  try{
    const {data:stored}=await supabase.from('users').select('photo_url').eq('telegram_id',telegramId).maybeSingle();
    if(stored?.photo_url)return String(stored.photo_url);
    if(!botToken)return null;

    const photosRes=await fetch(`https://api.telegram.org/bot${botToken}/getUserProfilePhotos?user_id=${telegramId}&limit=1`);
    const photosJson=await photosRes.json().catch(()=>null);
    const sizes=photosJson?.ok?photosJson?.result?.photos?.[0]:null;
    const best=Array.isArray(sizes)&&sizes.length?sizes[sizes.length-1]:null;
    if(!best?.file_id)return null;

    const fileRes=await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(best.file_id)}`);
    const fileJson=await fileRes.json().catch(()=>null);
    const filePath=fileJson?.ok?fileJson?.result?.file_path:null;
    if(!filePath)return null;

    const imageRes=await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
    if(!imageRes.ok)return null;
    const bytes=await imageRes.arrayBuffer();
    if(!bytes.byteLength)return null;

    const rawExt=String(filePath).split('.').pop()?.toLowerCase()||'jpg';
    const ext=['jpg','jpeg','png','webp'].includes(rawExt)?rawExt:'jpg';
    const contentType=imageRes.headers.get('content-type')||(
      ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg'
    );
    const objectPath=`${telegramId}.${ext}`;
    const {error:uploadError}=await supabase.storage.from('user-avatars').upload(objectPath,bytes,{
      upsert:true,
      contentType,
      cacheControl:'86400',
    });
    if(uploadError){console.error('avatar upload failed',uploadError.message);return null;}
    const {data:publicData}=supabase.storage.from('user-avatars').getPublicUrl(objectPath);
    return publicData?.publicUrl||null;
  }catch(error){
    console.error('avatar resolution failed',error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const initData = req.headers.get('x-telegram-init-data') || '';
    const botToken=Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const telegramUser = await verifyTelegramInitData(initData, botToken);
    const { referralCode } = await req.json().catch(() => ({}));

    const safeReferral = typeof referralCode === 'string' && /^\d{1,20}$/.test(referralCode) ? referralCode : null;
    const photoUrl=telegramUser.photo_url||await resolveTelegramPhoto(supabase,botToken,telegramUser.id);
    const { data: registration, error: registrationError } = await supabase.rpc('register_telegram_user', {
      p_telegram_id: telegramUser.id,
      p_first_name: telegramUser.first_name,
      p_last_name: telegramUser.last_name || null,
      p_username: telegramUser.username || null,
      p_photo_url: photoUrl || null,
      p_referral_code: safeReferral,
    });
    if (registrationError || !registration?.user) throw registrationError || new Error('Failed to register user');

    const { data: supportSetting } = await supabase.from('settings').select('value').eq('key','support_username').maybeSingle();
    const supportUsername = String(supportSetting?.value || '').trim() || null;

    if (registration.user.is_banned) {
      const { data: bannedUser } = await supabase.from('users').select('*').eq('id', registration.user.id).single();
      return new Response(JSON.stringify({
        user: bannedUser || registration.user,
        support_username: supportUsername,
        restricted: true,
      }), {
        status:200,
        headers:{...corsHeaders,'Content-Type':'application/json'},
      });
    }

    const detectedLanguage=String(telegramUser.language_code||'').toLowerCase().split('-')[0];
    if(!registration.user.bot_language&&['en','hi','ru','bn','id','tr','es','pt','fr','de','uk','zh'].includes(detectedLanguage)){
      await supabase.from('users').update({bot_language:detectedLanguage}).eq('id',registration.user.id).is('bot_language',null);
      registration.user.bot_language=detectedLanguage;
    }
    const {data:comeback}=await supabase.rpc('claim_comeback_reward',{p_user_id:registration.user.id});
    return new Response(JSON.stringify({
      user: registration.user,
      support_username: supportUsername,
      registration: {
        created: Boolean(registration.created),
        welcomeBonus: Number(registration.welcomeBonus || 0),
        referralBonus: Number(registration.referralBonus || 0),
        totalBonus: Number(registration.totalBonus || 0),
        comeback: comeback?.success ? comeback : null,
      },
    }), { headers:{...corsHeaders,'Content-Type':'application/json'} });
  } catch (error) {
    const message=(error as Error).message;
    const status=/Telegram|expired|signature|authentication/i.test(message)?401:400;
    return new Response(JSON.stringify({ error:message }), {status,headers:{...corsHeaders,'Content-Type':'application/json'}});
  }
});
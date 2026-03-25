import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';

const app = express();
const PORT = 3001;

// ── Supabase admin client (SERVICE ROLE — never sent to browser) ─────────────
const SUPABASE_URL = 'https://utfkqzmrcdfbnjdkjais.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TELEGRAM_BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN || '';
const ADMIN_TELEGRAM_ID    = parseInt(process.env.ADMIN_TELEGRAM_ID || '0', 10);

if (!SUPABASE_SERVICE_KEY) {
  console.error('FATAL: SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '16kb' }));

// Global rate limit: 120 req / minute per IP
const globalLimiter = rateLimit({
  windowMs: 60_000, max: 120,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Too many requests' },
});
app.use(globalLimiter);

// Strict limiter for mutating endpoints: 30 req / minute per IP
const strictLimiter = rateLimit({
  windowMs: 60_000, max: 30,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, message: 'Rate limit exceeded' },
});

// ── Helpers ──────────────────────────────────────────────────────────────────
function isUUID(s: unknown): s is string {
  return typeof s === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

async function resolveUserId(userId: string): Promise<string | null> {
  if (!isUUID(userId)) return null;
  const { data } = await db.from('users').select('id, is_banned').eq('id', userId).single();
  if (!data || data.is_banned) return null;
  return data.id;
}

async function getBalance(userId: string) {
  const { data } = await db.from('balances').select('points, total_earned, stars_balance').eq('user_id', userId).single();
  return data;
}

async function creditPoints(userId: string, pts: number, type: string, description: string) {
  const { data: bal, error } = await db.from('balances').select('points, total_earned').eq('user_id', userId).single();
  if (error || !bal) throw new Error('Balance not found');
  await db.from('balances').update({ points: bal.points + pts, total_earned: bal.total_earned + pts }).eq('user_id', userId);
  await db.from('users').select('total_points').eq('id', userId).single().then(async ({ data: u }) => {
    if (u) {
      const newTotal = u.total_points + pts;
      await db.from('users').update({ total_points: newTotal, level: Math.floor(newTotal / 10000) + 1 }).eq('id', userId);
    }
  });
  await db.from('transactions').insert({ user_id: userId, type, points: pts, description });
}

async function sendTg(chatId: number, text: string) {
  if (!TELEGRAM_BOT_TOKEN || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

function ok(res: express.Response, data: object = {}) {
  return res.json({ success: true, ...data });
}
function err(res: express.Response, message: string, status = 200) {
  return res.status(status).json({ success: false, message });
}

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ════════════════════════════════════════════════════════════════════════════
// AUTH — Telegram user init
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/telegram', strictLimiter, async (req, res) => {
  const { telegramUser, referralCode } = req.body;
  if (!telegramUser?.id || typeof telegramUser.id !== 'number') return err(res, 'Invalid telegram user', 400);
  if (telegramUser.first_name && typeof telegramUser.first_name !== 'string') return err(res, 'Invalid data', 400);

  try {
    const { data: existingUser } = await db.from('users').select('*').eq('telegram_id', telegramUser.id).single();

    if (existingUser) {
      await db.from('users').update({ last_active_at: new Date().toISOString(), photo_url: telegramUser.photo_url || null }).eq('id', existingUser.id);
      return ok(res, { user: existingUser });
    }

    const referralCodeGen = String(telegramUser.id);
    let referrerId: string | null = null;
    if (referralCode && referralCode !== String(telegramUser.id)) {
      const refId = parseInt(String(referralCode), 10);
      if (!isNaN(refId)) {
        const { data: referrer } = await db.from('users').select('id').eq('telegram_id', refId).single();
        if (referrer) referrerId = referrer.id;
      }
    }

    const { data: newUser, error: userError } = await db.from('users').insert({
      telegram_id:   telegramUser.id,
      first_name:    String(telegramUser.first_name || '').slice(0, 64),
      last_name:     telegramUser.last_name ? String(telegramUser.last_name).slice(0, 64) : null,
      username:      telegramUser.username  ? String(telegramUser.username).slice(0, 64)  : null,
      photo_url:     telegramUser.photo_url ? String(telegramUser.photo_url).slice(0, 512): null,
      referral_code: referralCodeGen,
      referred_by:   referralCode ? parseInt(String(referralCode), 10) : null,
    }).select().single();

    if (userError || !newUser) throw userError || new Error('Failed to create user');

    // Welcome balance
    await db.from('balances').insert({ user_id: newUser.id, points: 200 });
    await db.from('transactions').insert({ user_id: newUser.id, type: 'bonus', points: 200, description: '🎉 Welcome bonus' });

    await sendTg(telegramUser.id, `🎉 <b>Welcome!</b>\n\nYou received <b>200 points</b> as a welcome bonus!\n\nComplete tasks, spin the wheel, and invite friends to earn more! 🚀`);

    // Referral
    if (referrerId) {
      const { data: settings } = await db.from('settings').select('key, value');
      const s: Record<string, string> = {};
      (settings || []).forEach((x: any) => { s[x.key] = x.value; });
      const referralBonus  = parseInt(s.points_per_referral || '500', 10);
      const referredBonus  = parseInt(s.referral_bonus_referred || '200', 10);

      await db.from('referrals').insert({ referrer_id: referrerId, referred_id: newUser.id, points_earned: referralBonus, is_verified: true });
      await creditPoints(referrerId, referralBonus, 'referral', `👥 Referral bonus from @${telegramUser.username || telegramUser.first_name}`);
      await creditPoints(newUser.id, referredBonus, 'referral', '🔗 Joined via referral bonus');
      await db.from('notifications').insert({ user_id: referrerId, title: '👥 New Referral!', message: `@${telegramUser.username || telegramUser.first_name} joined using your link! +${referralBonus} points!`, type: 'referral' });

      const { data: referrerUser } = await db.from('users').select('telegram_id').eq('id', referrerId).single();
      if (referrerUser) {
        await sendTg(referrerUser.telegram_id, `👥 <b>New Referral!</b>\n\n@${telegramUser.username || telegramUser.first_name} joined using your link!\n+${referralBonus} points added! 🎉`);
      }

      // Track invite contests
      const now = new Date().toISOString();
      const { data: inviteContests } = await db.from('contests').select('id').eq('contest_type', 'invite').eq('is_active', true).lte('starts_at', now).gte('ends_at', now);
      for (const contest of (inviteContests || [])) {
        const { data: existing } = await db.from('contest_entries').select('id, score').eq('contest_id', contest.id).eq('user_id', referrerId).single();
        if (existing) await db.from('contest_entries').update({ score: existing.score + 1, updated_at: now }).eq('id', existing.id);
        else await db.from('contest_entries').insert({ contest_id: contest.id, user_id: referrerId, score: 1 });
      }
    }

    return ok(res, { user: newUser });
  } catch (e: any) {
    console.error('telegram-auth error:', e);
    return err(res, 'Internal error', 500);
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DAILY REWARD
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/daily-reward', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await db.from('daily_claims').select('id').eq('user_id', uid).eq('claim_date', today).single();
  if (existing) return err(res, 'Already claimed today! Come back tomorrow 🌙');

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const { data: lastClaim } = await db.from('daily_claims').select('day_streak').eq('user_id', uid).eq('claim_date', yesterday).single();
  const streak = lastClaim ? lastClaim.day_streak + 1 : 1;
  const totalPoints = 100 + Math.min(streak * 10, 500);

  await db.from('daily_claims').insert({ user_id: uid, claim_date: today, day_streak: streak, points_earned: totalPoints });
  await creditPoints(uid, totalPoints, 'daily', `🎁 Daily reward (Day ${streak} streak)`);

  const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
  if (user) await sendTg(user.telegram_id, `🎁 <b>Daily Reward!</b>\n\n+${totalPoints} points\n🔥 Streak: Day ${streak}`);

  return ok(res, { points: totalPoints, streak });
});

// ════════════════════════════════════════════════════════════════════════════
// DAILY DROP (streak calendar)
// ════════════════════════════════════════════════════════════════════════════
const DAILY_DROP = [100, 120, 130, 140, 150, 160, 170];

app.post('/api/daily-drop', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const today = new Date().toISOString().split('T')[0];

  // Check already claimed today
  const { data: todayClaim } = await db.from('daily_claims').select('id').eq('user_id', uid).eq('claim_date', today).maybeSingle();
  if (todayClaim) return err(res, 'Already claimed today');

  // Get streak
  const { data: claims } = await db.from('daily_claims').select('claim_date').eq('user_id', uid).order('claim_date', { ascending: false }).limit(8);
  let streak = 0;
  const now = new Date(); now.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < (claims || []).length; i++) {
    const claimDate = new Date((claims![i] as any).claim_date);
    const expected = new Date(now); expected.setUTCDate(now.getUTCDate() - (i + 1));
    if (claimDate.toISOString().split('T')[0] === expected.toISOString().split('T')[0]) streak++;
    else break;
  }

  const dayIndex = streak % 7;
  const reward = DAILY_DROP[dayIndex];

  const { error: claimError } = await db.from('daily_claims').insert({ user_id: uid, claim_date: today, day_streak: streak + 1, points_earned: reward });
  if (claimError) return err(res, 'Already claimed');

  await creditPoints(uid, reward, 'daily_drop', `🎁 Daily Drop Day ${dayIndex + 1}: +${reward} pts`);

  return ok(res, { points: reward, streak: streak + 1, dayIndex });
});

// ════════════════════════════════════════════════════════════════════════════
// SPIN WHEEL — server picks outcome, not client
// ════════════════════════════════════════════════════════════════════════════
const SPIN_PRIZES = [
  { type: 'points', points: 50  },
  { type: 'points', points: 100 },
  { type: 'points', points: 40  },
  { type: 'points', points: 200 },
  { type: 'points', points: 500 },
  { type: 'empty',  points: 0   },
  { type: 'points', points: 300 },
  { type: 'empty',  points: 0   },
];
const SPIN_WEIGHTS = [0.30, 0.25, 0.15, 0.08, 0.02, 0.07, 0.06, 0.07];

function selectSpinPrize() {
  const rand = Math.random();
  let cum = 0;
  for (let i = 0; i < SPIN_PRIZES.length; i++) {
    cum += SPIN_WEIGHTS[i];
    if (rand <= cum) return { ...SPIN_PRIZES[i], index: i };
  }
  return { ...SPIN_PRIZES[0], index: 0 };
}

const SPIN_COOLDOWN_HOURS = 4;
const MAX_SPINS_PER_WINDOW = 3;

app.post('/api/spin-wheel', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const cutoff = new Date(Date.now() - SPIN_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { count } = await db.from('spin_results').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('spun_at', cutoff);
  if ((count || 0) >= MAX_SPINS_PER_WINDOW) return err(res, `Daily spin limit reached! Come back in ${SPIN_COOLDOWN_HOURS} hours.`);

  const prize = selectSpinPrize();

  await db.from('spin_results').insert({ user_id: uid, result_type: prize.type, points_earned: prize.points, stars_earned: 0 });

  if (prize.type !== 'empty' && prize.points > 0) {
    await creditPoints(uid, prize.points, 'spin', `🎡 Spin: ${prize.points} points won!`);
    if (prize.points >= 200) {
      const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
      if (user) await sendTg(user.telegram_id, `🎡 <b>Spin Win!</b>\n\nYou won <b>${prize.points} points</b>! 🎉`);
    }
  }

  const remaining = MAX_SPINS_PER_WINDOW - ((count || 0) + 1);
  return ok(res, { result: prize.type, points: prize.points, stars: 0, index: prize.index, spinsLeft: remaining });
});

// Get spin count
app.post('/api/spin-count', async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  const cutoff = new Date(Date.now() - SPIN_COOLDOWN_HOURS * 3_600_000).toISOString();
  const { data } = await db.from('spin_results').select('spun_at').eq('user_id', uid).gte('spun_at', cutoff).order('spun_at', { ascending: false });
  return ok(res, { spins: data || [], cooldownHours: SPIN_COOLDOWN_HOURS, maxSpins: MAX_SPINS_PER_WINDOW });
});

// ════════════════════════════════════════════════════════════════════════════
// COMPLETE TASK
// ════════════════════════════════════════════════════════════════════════════
async function verifyTgMembership(chatId: string, telegramId: number): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN) return true;
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getChatMember?chat_id=${chatId}&user_id=${telegramId}`;
    const res = await fetch(url);
    const data = await res.json() as any;
    return data.ok && ['member', 'administrator', 'creator'].includes(data.result?.status);
  } catch { return false; }
}

app.post('/api/complete-task', strictLimiter, async (req, res) => {
  const { userId, taskId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || !isUUID(taskId)) return err(res, 'Invalid request', 400);

  const { data: task } = await db.from('tasks').select('*').eq('id', taskId).eq('is_active', true).single();
  if (!task) return err(res, 'Task not found or inactive');

  // Check completion
  if (!task.is_repeatable) {
    const { data: existing } = await db.from('user_tasks').select('id').eq('user_id', uid).eq('task_id', taskId).single();
    if (existing) return err(res, 'Task already completed!');
  } else {
    const { data: last } = await db.from('user_tasks').select('next_available_at').eq('user_id', uid).eq('task_id', taskId).order('completed_at', { ascending: false }).limit(1).single();
    if (last?.next_available_at && new Date(last.next_available_at) > new Date()) return err(res, 'Task cooldown not finished yet');
  }

  // Verify TG membership
  if (task.task_type === 'social' && task.link?.includes('t.me/')) {
    const { data: userData } = await db.from('users').select('telegram_id').eq('id', uid).single();
    if (userData) {
      const match = task.link.match(/t\.me\/([a-zA-Z0-9_]+)/);
      if (match) {
        const isMember = await verifyTgMembership(`@${match[1]}`, userData.telegram_id);
        if (!isMember) return err(res, 'Please join the channel/group first, then try again!');
      }
    }
  }

  const points = task.reward_points;
  const nextAvailable = task.is_repeatable ? new Date(Date.now() + (task.repeat_hours || 24) * 3_600_000).toISOString() : null;

  await db.from('user_tasks').insert({ user_id: uid, task_id: taskId, points_earned: points, next_available_at: nextAvailable });
  await creditPoints(uid, points, 'task_complete', `✅ Task: ${task.title}`);

  const { data: user } = await db.from('users').select('telegram_id').eq('id', uid).single();
  if (user) await sendTg(user.telegram_id, `✅ <b>Task Completed!</b>\n\n${task.title}\n+${points} points earned! 🎉`);

  return ok(res, { points });
});

// ════════════════════════════════════════════════════════════════════════════
// LOG AD WATCH — rate-limited, server tracks count
// ════════════════════════════════════════════════════════════════════════════
const AD_REWARD_PTS = 50;
const AD_MAX_PER_DAY = 20;

app.post('/api/log-ad', strictLimiter, async (req, res) => {
  const { userId, adType } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || typeof adType !== 'string') return err(res, 'Invalid request', 400);

  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ad_type', 'ad_watch').gte('created_at', startOfDay.toISOString());
  if ((count || 0) >= AD_MAX_PER_DAY) return err(res, 'Daily ad limit reached');

  await db.from('ad_logs').insert({ user_id: uid, ad_type: adType.slice(0, 64), reward_given: AD_REWARD_PTS, provider: 'adsgram' });
  await creditPoints(uid, AD_REWARD_PTS, 'ad_watch', `🎬 Ad Watch: +${AD_REWARD_PTS} pts`);

  // Track ads_watch contests
  const now = new Date().toISOString();
  const { data: activeContests } = await db.from('contests').select('id').eq('contest_type', 'ads_watch').eq('is_active', true).lte('starts_at', now).gte('ends_at', now);
  for (const contest of (activeContests || [])) {
    const { data: existing } = await db.from('contest_entries').select('id, score').eq('contest_id', contest.id).eq('user_id', uid).single();
    if (existing) await db.from('contest_entries').update({ score: existing.score + 1, updated_at: now }).eq('id', existing.id);
    else await db.from('contest_entries').insert({ contest_id: contest.id, user_id: uid, score: 1 });
  }

  const newCount = (count || 0) + 1;
  return ok(res, { points: AD_REWARD_PTS, adsToday: newCount, remaining: AD_MAX_PER_DAY - newCount });
});

// Get today's ad count
app.post('/api/ad-count', async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count } = await db.from('ad_logs').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('ad_type', 'ad_watch').gte('created_at', startOfDay.toISOString());
  return ok(res, { adsToday: count || 0, maxPerDay: AD_MAX_PER_DAY });
});

// ════════════════════════════════════════════════════════════════════════════
// FARM CLAIM — server validates timing
// ════════════════════════════════════════════════════════════════════════════
const FARM_DURATION_MS = 15 * 60 * 1000;
const FARM_REWARD_PTS  = 100;

app.post('/api/farm-claim', strictLimiter, async (req, res) => {
  const { userId, farmStartedAt } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (typeof farmStartedAt !== 'number') return err(res, 'Invalid farm time', 400);

  const elapsed = Date.now() - farmStartedAt;
  if (elapsed < FARM_DURATION_MS) return err(res, `Farm not ready yet. ${Math.ceil((FARM_DURATION_MS - elapsed) / 60000)} min remaining.`);

  // Prevent multiple claims: check if they already claimed a farm recently
  const recentCutoff = new Date(Date.now() - FARM_DURATION_MS).toISOString();
  const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', 'farm_claim').gte('created_at', recentCutoff);
  if ((count || 0) > 0) return err(res, 'Farm already claimed recently');

  await creditPoints(uid, FARM_REWARD_PTS, 'farm_claim', `🌾 Farm: +${FARM_REWARD_PTS} pts`);
  return ok(res, { points: FARM_REWARD_PTS });
});

// ════════════════════════════════════════════════════════════════════════════
// GAME RESULTS — server validates outcome & credits
// ════════════════════════════════════════════════════════════════════════════
const GAME_DAILY_LIMITS: Record<string, number> = {
  card_flip:    10,
  dice_roll:    10,
  number_guess: 10,
  lucky_box:    5,
  tower_climb:  20,
};

async function checkGameLimit(uid: string, gameType: string): Promise<boolean> {
  const limit = GAME_DAILY_LIMITS[gameType];
  if (!limit) return false;
  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const table = gameType === 'tower_climb' ? 'tower_runs' : 'transactions';
  const field  = gameType === 'tower_climb' ? 'created_at' : 'created_at';
  const filter = gameType === 'tower_climb'
    ? db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).gte(field, startOfDay.toISOString())
    : db.from(table).select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('type', gameType).gte(field, startOfDay.toISOString());
  const { count } = await filter;
  return (count || 0) >= limit;
}

// Card Flip
app.post('/api/game/card-flip', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'card_flip')) return err(res, 'Daily game limit reached');

  const SYMBOLS = ['🎯','⭐','💎','🔥','🎪','🚀','👑','🌟'];
  const cards = Array.from({ length: 3 }, () => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  const unique = new Set(cards).size;

  let pts: number;
  let matchType: string;
  if (unique === 1)      { pts = 100; matchType = 'triple'; }
  else if (unique === 2) { pts = 50;  matchType = 'pair';   }
  else                   { pts = 10 + Math.floor(Math.random() * 15); matchType = 'none'; }

  await creditPoints(uid, pts, 'card_flip', `🃏 Card Flip: ${matchType === 'triple' ? 'Triple Match' : matchType === 'pair' ? 'Pair' : 'No Match'} +${pts} pts`);
  return ok(res, { cards, pts, matchType });
});

// Dice Roll
app.post('/api/game/dice-roll', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'dice_roll')) return err(res, 'Daily game limit reached');

  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  const total = d1 + d2;

  let pts: number;
  if (total === 12)      pts = 100;
  else if (total >= 10)  pts = 60;
  else if (total >= 8)   pts = 40;
  else if (total >= 6)   pts = 20;
  else                   pts = 10;

  await creditPoints(uid, pts, 'dice_roll', `🎲 Dice Roll: ${d1}+${d2}=${total} → +${pts} pts`);
  return ok(res, { d1, d2, total, pts });
});

// Number Guess
const NG_TIERS = [
  { range: 1, pts: 100, label: 'Exact Hit!' },
  { range: 2, pts: 60,  label: 'Very Close!' },
  { range: 4, pts: 30,  label: 'Close!' },
  { range: 7, pts: 15,  label: 'Near' },
];

app.post('/api/game/number-guess', strictLimiter, async (req, res) => {
  const { userId, guess } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (typeof guess !== 'number' || guess < 1 || guess > 10 || !Number.isInteger(guess)) return err(res, 'Invalid guess', 400);
  if (await checkGameLimit(uid, 'number_guess')) return err(res, 'Daily game limit reached');

  const secret = Math.floor(Math.random() * 10) + 1;
  const diff = Math.abs(guess - secret);
  const tier = NG_TIERS.find(t => diff <= t.range) || { pts: 5, label: 'Too far' };

  await creditPoints(uid, tier.pts, 'number_guess', `🎯 Number Guess: guessed ${guess}, was ${secret} → +${tier.pts} pts`);
  return ok(res, { guess, secret, diff, pts: tier.pts, label: tier.label });
});

// Lucky Box
const LUCKY_BOX_PRIZES = [
  { points: 0,   label: 'Empty',       emoji: '💨', tier: 'empty',   prob: 0.30 },
  { points: 10,  label: '+10 Points',  emoji: '🪙', tier: 'small',   prob: 0.25 },
  { points: 25,  label: '+25 Points',  emoji: '✨', tier: 'small',   prob: 0.20 },
  { points: 50,  label: '+50 Points',  emoji: '🔥', tier: 'medium',  prob: 0.14 },
  { points: 100, label: '+100 Points', emoji: '💰', tier: 'big',     prob: 0.05 },
  { points: 200, label: '+200 Points', emoji: '💎', tier: 'big',     prob: 0.03 },
  { points: 300, label: '+300 Points', emoji: '👑', tier: 'big',     prob: 0.02 },
  { points: 500, label: '+500 Points!',emoji: '🏆', tier: 'jackpot', prob: 0.01 },
];

app.post('/api/game/lucky-box', strictLimiter, async (req, res) => {
  const { userId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (await checkGameLimit(uid, 'lucky_box')) return err(res, 'Daily game limit reached');

  const rand = Math.random();
  let cum = 0;
  let prize = LUCKY_BOX_PRIZES[0];
  for (const p of LUCKY_BOX_PRIZES) { cum += p.prob; if (rand <= cum) { prize = p; break; } }

  if (prize.points > 0) {
    await creditPoints(uid, prize.points, 'lucky_box', `🎁 Lucky Box: ${prize.label}`);
  } else {
    await db.from('transactions').insert({ user_id: uid, type: 'lucky_box', points: 0, description: '🎁 Lucky Box: Empty' });
  }
  return ok(res, prize);
});

// Tower Climb
const TOWER_MAX_FLOORS = 50;
const TOWER_PTS_PER_FLOOR = 3;

app.post('/api/game/tower-climb', strictLimiter, async (req, res) => {
  const { userId, floorsReached, revivesUsed } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);

  // Server-side sanity check
  const floors = Math.min(Math.max(0, Math.floor(Number(floorsReached) || 0)), TOWER_MAX_FLOORS);
  const revives = Math.min(Math.max(0, Math.floor(Number(revivesUsed) || 0)), 3);

  if (await checkGameLimit(uid, 'tower_climb')) return err(res, 'Daily game limit reached');

  const pts = Math.floor(floors * TOWER_PTS_PER_FLOOR);

  await db.from('tower_runs').insert({ user_id: uid, floors_reached: floors, points_earned: pts, revives_used: revives, shields_used: 0 });

  const { data: existing } = await db.from('tower_leaderboard').select('id, best_floor, total_runs, total_floors').eq('user_id', uid).maybeSingle();
  if (existing) {
    await db.from('tower_leaderboard').update({ best_floor: Math.max(existing.best_floor, floors), total_runs: existing.total_runs + 1, total_floors: existing.total_floors + floors, updated_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await db.from('tower_leaderboard').insert({ user_id: uid, best_floor: floors, total_floors: floors, total_runs: 1 });
  }

  if (pts > 0) await creditPoints(uid, pts, 'tower_climb', `🏗️ Tower Climb: ${floors} floors → +${pts} pts`);

  return ok(res, { floors, pts });
});

// ════════════════════════════════════════════════════════════════════════════
// WITHDRAWAL
// ════════════════════════════════════════════════════════════════════════════
const TON_TIERS: Record<number, number> = { 5000: 0.05, 10000: 0.1, 15000: 0.15, 20000: 0.2 };
const UPI_RATE = 0.0012;

app.post('/api/withdraw', strictLimiter, async (req, res) => {
  const { userId, method, points, walletAddress } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid) return err(res, 'Invalid user', 400);
  if (!method || !['ton', 'upi'].includes(method)) return err(res, 'Invalid method');
  if (!points || typeof points !== 'number' || points <= 0 || !Number.isInteger(points)) return err(res, 'Invalid points');
  if (typeof walletAddress !== 'string' || !walletAddress.trim()) return err(res, 'Wallet/UPI required');

  if (method === 'ton' && !/^UQ[A-Za-z0-9_-]{46,}$/.test(walletAddress.trim())) return err(res, 'Invalid TON wallet address');
  if (method === 'upi' && !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(walletAddress.trim())) return err(res, 'Invalid UPI ID format');

  const { data: settings } = await db.from('settings').select('key, value');
  const s: Record<string, string> = {};
  (settings || []).forEach((x: any) => { s[x.key] = x.value; });
  const minPoints  = parseInt(s.min_withdrawal_points || '5000', 10);
  const maxPending = parseInt(s.max_pending_withdrawals || '2', 10);
  const maxDaily   = parseInt(s.max_daily_withdrawals || '3', 10);

  if (points < minPoints) return err(res, `Minimum withdrawal is ${minPoints.toLocaleString()} points`);

  // Compute amount server-side
  let amount: number;
  let amountStr: string;
  if (method === 'upi') {
    amount = parseFloat((points * UPI_RATE).toFixed(2));
    amountStr = `₹${amount} INR`;
  } else {
    const ton = TON_TIERS[points];
    if (!ton) return err(res, `Invalid TON tier. Valid: ${Object.keys(TON_TIERS).join(', ')} pts`);
    amount = ton; amountStr = `${amount.toFixed(2)} TON`;
  }

  const bal = await getBalance(uid);
  if (!bal || bal.points < points) return err(res, `Insufficient balance. You have ${(bal?.points || 0).toLocaleString()} pts`);

  const { count: pendingCount } = await db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'pending');
  if ((pendingCount || 0) >= maxPending) return err(res, 'Too many pending withdrawals. Wait for them to be processed.');

  const startOfDay = new Date(); startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: todayCount } = await db.from('withdrawals').select('id', { count: 'exact', head: true }).eq('user_id', uid).gte('created_at', startOfDay.toISOString());
  if ((todayCount || 0) >= maxDaily) return err(res, 'Daily withdrawal limit reached. Try again tomorrow.');

  await db.from('withdrawals').insert({ user_id: uid, method, points_spent: points, amount, wallet_address: walletAddress.trim(), status: 'pending' });
  await db.from('balances').update({ points: bal.points - points, total_withdrawn: (bal as any).total_withdrawn + points }).eq('user_id', uid);
  await db.from('transactions').insert({ user_id: uid, type: 'spend', points: -points, description: `💸 Withdrawal: ${amountStr} via ${method.toUpperCase()}` });
  await db.from('notifications').insert({ user_id: uid, title: '💸 Withdrawal Submitted', message: `Your withdrawal of ${points.toLocaleString()} pts → ${amountStr} is pending review.`, type: 'withdrawal' });

  const { data: userData } = await db.from('users').select('telegram_id, first_name, username').eq('id', uid).single();
  if (userData) {
    await sendTg(userData.telegram_id, `💸 <b>Withdrawal Submitted</b>\n\nMethod: <b>${method.toUpperCase()}</b>\nAmount: <b>${amountStr}</b>\nPoints: <b>${points.toLocaleString()}</b>`);
    if (ADMIN_TELEGRAM_ID) {
      await sendTg(ADMIN_TELEGRAM_ID, `🔔 <b>New Withdrawal</b>\n\n👤 ${userData.first_name || 'Unknown'} (@${userData.username || 'N/A'})\n💳 ${method.toUpperCase()} · ${amountStr}\n🪙 ${points.toLocaleString()} pts`);
    }
  }

  return ok(res, { message: 'Withdrawal request submitted successfully!' });
});

// ════════════════════════════════════════════════════════════════════════════
// PROMO CLAIM
// ════════════════════════════════════════════════════════════════════════════
app.post('/api/promo/claim', strictLimiter, async (req, res) => {
  const { userId, promoId } = req.body;
  const uid = await resolveUserId(userId);
  if (!uid || !isUUID(promoId)) return err(res, 'Invalid request', 400);

  const { data: promo } = await db.from('promos').select('*').eq('id', promoId).eq('is_active', true).single();
  if (!promo) return err(res, 'Promo not found or inactive');

  // Atomic check+claim via unique constraint
  const { error: claimErr } = await db.from('promo_claims').insert({ promo_id: promoId, user_id: uid });
  if (claimErr) return err(res, 'Already claimed this promo');

  const { data: fresh } = await db.from('promos').select('total_claimed, max_claims').eq('id', promoId).single();
  if (!fresh || fresh.total_claimed >= fresh.max_claims) {
    await db.from('promo_claims').delete().eq('promo_id', promoId).eq('user_id', uid);
    return err(res, 'Promo slots are full');
  }

  await db.from('promos').update({ total_claimed: fresh.total_claimed + 1 }).eq('id', promoId);
  await creditPoints(uid, promo.reward_points, 'promo', `🎁 Promo: ${promo.title}`);
  return ok(res, { points: promo.reward_points });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN — protected by ADMIN_TELEGRAM_ID
// ════════════════════════════════════════════════════════════════════════════
async function requireAdmin(req: express.Request, res: express.Response): Promise<number | null> {
  const adminId = parseInt(String(req.body.adminTelegramId || req.query.adminTelegramId), 10);
  if (!adminId || adminId !== ADMIN_TELEGRAM_ID) { err(res, 'Unauthorized', 403); return null; }
  return adminId;
}

app.post('/api/admin/withdrawal', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { withdrawalId, status, adminNote } = req.body;
  if (!isUUID(withdrawalId) || !['approved', 'rejected'].includes(status)) return err(res, 'Invalid request', 400);

  const { data: withdrawal } = await db.from('withdrawals').select('user_id, points_spent, amount, method').eq('id', withdrawalId).single();
  if (!withdrawal) return err(res, 'Withdrawal not found');

  await db.from('withdrawals').update({ status, admin_note: adminNote || null, processed_at: new Date().toISOString() }).eq('id', withdrawalId);

  if (status === 'rejected') {
    const bal = await getBalance(withdrawal.user_id);
    if (bal) {
      await db.from('balances').update({ points: bal.points + withdrawal.points_spent, total_withdrawn: Math.max(0, (bal as any).total_withdrawn - withdrawal.points_spent) }).eq('user_id', withdrawal.user_id);
      await db.from('transactions').insert({ user_id: withdrawal.user_id, type: 'refund', points: withdrawal.points_spent, description: `🔄 Withdrawal rejected — ${withdrawal.points_spent.toLocaleString()} pts refunded` });
    }
  }

  const msg = status === 'approved'
    ? `✅ Your withdrawal of ${Number(withdrawal.amount).toFixed(2)} ${withdrawal.method.toUpperCase()} has been approved!`
    : `❌ Your withdrawal was rejected.${adminNote ? ` Reason: ${adminNote}` : ''} Points refunded.`;
  await db.from('notifications').insert({ user_id: withdrawal.user_id, title: status === 'approved' ? '✅ Withdrawal Approved!' : '❌ Withdrawal Rejected', message: msg, type: 'withdrawal' });

  const { data: userData } = await db.from('users').select('telegram_id').eq('id', withdrawal.user_id).single();
  if (userData) await sendTg(userData.telegram_id, msg);

  return ok(res, { message: 'Updated' });
});

app.post('/api/admin/adjust-balance', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { userId, points, reason } = req.body;
  const uid = isUUID(userId) ? userId : null;
  if (!uid || typeof points !== 'number' || !Number.isInteger(points)) return err(res, 'Invalid request', 400);

  const bal = await getBalance(uid);
  if (!bal) return err(res, 'User not found');
  const newPoints = Math.max(0, bal.points + points);
  await db.from('balances').update({ points: newPoints }).eq('user_id', uid);
  await db.from('transactions').insert({ user_id: uid, type: points > 0 ? 'admin_credit' : 'admin_debit', points, description: `⚙️ Admin adjustment: ${reason || 'No reason'}` });
  return ok(res, { newPoints });
});

app.post('/api/admin/ban-user', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { userId, banned } = req.body;
  if (!isUUID(userId)) return err(res, 'Invalid userId', 400);
  await db.from('users').update({ is_banned: !!banned }).eq('id', userId);
  return ok(res);
});

app.post('/api/admin/setting', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { key, value } = req.body;
  if (typeof key !== 'string' || typeof value !== 'string') return err(res, 'Invalid request', 400);
  const { data: existing } = await db.from('settings').select('id').eq('key', key).single();
  if (existing) await db.from('settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
  else await db.from('settings').insert({ key, value });
  return ok(res);
});

app.post('/api/admin/broadcast', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { message, adminTelegramId } = req.body;
  if (typeof message !== 'string' || !message.trim()) return err(res, 'No message', 400);

  await db.from('broadcasts').insert({ message, sent_by: adminTelegramId });
  const { data: users } = await db.from('users').select('id').limit(10000);
  if (users && users.length > 0) {
    const notifs = (users as any[]).map(u => ({ user_id: u.id, title: '📢 Announcement', message, type: 'info' }));
    for (let i = 0; i < notifs.length; i += 100) await db.from('notifications').insert(notifs.slice(i, i + 100));
  }
  return ok(res, { sent: users?.length || 0 });
});

app.post('/api/admin/end-contest', strictLimiter, async (req, res) => {
  if (!(await requireAdmin(req, res))) return;
  const { contestId } = req.body;
  if (!isUUID(contestId)) return err(res, 'Invalid contestId', 400);

  const { data: contest } = await db.from('contests').select('*').eq('id', contestId).single();
  if (!contest) return err(res, 'Contest not found');
  if (contest.rewards_distributed) return err(res, 'Rewards already distributed');

  const { data: entries } = await db.from('contest_entries').select('user_id, score').eq('contest_id', contestId).order('score', { ascending: false }).limit(5);
  if (!entries || entries.length === 0) return err(res, 'No entries found');

  const rewards = [contest.reward_1st, contest.reward_2nd, contest.reward_3rd, contest.reward_4th, contest.reward_5th];
  const medals = ['🥇', '🥈', '🥉', '4th', '5th'];

  for (let i = 0; i < entries.length; i++) {
    const reward = rewards[i] || 0;
    if (reward <= 0) continue;
    const entry = entries[i] as any;
    await creditPoints(entry.user_id, reward, 'contest_reward', `🏆 ${medals[i]} Contest "${contest.title}" reward!`);
    await db.from('notifications').insert({ user_id: entry.user_id, title: '🏆 Contest Winner!', message: `You placed ${medals[i]} in "${contest.title}" and won ${reward.toLocaleString()} points!`, type: 'reward' });
    const { data: u } = await db.from('users').select('telegram_id').eq('id', entry.user_id).single();
    if (u) await sendTg((u as any).telegram_id, `🏆 <b>Contest Winner!</b>\n\nYou placed <b>${medals[i]}</b> in "${contest.title}"!\n+${reward.toLocaleString()} points! 🎉`);
  }

  await db.from('contests').update({ rewards_distributed: true, is_active: false }).eq('id', contestId);
  return ok(res, { distributed: entries.length });
});

// ════════════════════════════════════════════════════════════════════════════
// Start server
// ════════════════════════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Secure backend running on port ${PORT}`);
});

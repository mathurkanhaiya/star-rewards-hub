import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { userId, taskId } = await req.json();
    if (!userId || !taskId) throw new Error('Missing required fields');

    // Get task
    const { data: task } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .eq('is_active', true)
      .single();

    if (!task) {
      return new Response(JSON.stringify({ success: false, message: 'Task not found or inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if already completed (for non-repeatable tasks)
    if (!task.is_repeatable) {
      const { data: existing } = await supabase
        .from('user_tasks')
        .select('id')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .single();

      if (existing) {
        return new Response(JSON.stringify({ success: false, message: 'Task already completed!' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } else {
      // Check repeat cooldown
      const { data: lastCompletion } = await supabase
        .from('user_tasks')
        .select('next_available_at')
        .eq('user_id', userId)
        .eq('task_id', taskId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      if (lastCompletion?.next_available_at && new Date(lastCompletion.next_available_at) > new Date()) {
        return new Response(JSON.stringify({ success: false, message: 'Task cooldown not finished yet' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const points = task.reward_points;
    const nextAvailable = task.is_repeatable
      ? new Date(Date.now() + (task.repeat_hours || 24) * 3600000).toISOString()
      : null;

    // Record task completion
    await supabase.from('user_tasks').insert({
      user_id: userId,
      task_id: taskId,
      points_earned: points,
      next_available_at: nextAvailable,
    });

    // Update balance
    const { data: balance } = await supabase.from('balances').select('points, total_earned').eq('user_id', userId).single();
    if (balance) {
      await supabase.from('balances').update({
        points: balance.points + points,
        total_earned: balance.total_earned + points,
      }).eq('user_id', userId);
    }

    // Log transaction
    await supabase.from('transactions').insert({
      user_id: userId,
      type: 'earn',
      points,
      description: `✅ Task: ${task.title}`,
      reference_id: taskId,
    });

    // Update user total_points & level
    const { data: user } = await supabase.from('users').select('total_points').eq('id', userId).single();
    if (user) {
      const newTotal = user.total_points + points;
      const newLevel = Math.floor(newTotal / 10000) + 1;
      await supabase.from('users').update({ total_points: newTotal, level: newLevel }).eq('id', userId);
    }

    return new Response(JSON.stringify({ success: true, points }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

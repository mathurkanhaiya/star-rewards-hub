import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, getUserTasks, completeTask } from '@/lib/api';
import { Task } from '@/types/telegram';

/* ===============================
   TELEGRAM HAPTIC
================================ */
function triggerHaptic(type: 'impact' | 'success' | 'error' = 'impact') {
  if (typeof window !== 'undefined' && (window as any).Telegram) {
    const tg = (window as any).Telegram.WebApp;
    if (type === 'success') tg?.HapticFeedback?.notificationOccurred('success');
    else if (type === 'error') tg?.HapticFeedback?.notificationOccurred('error');
    else tg?.HapticFeedback?.impactOccurred('medium');
  }
}

/* ===============================
   COLORS
================================ */
const TASK_COLORS: Record<string, string> = {
  social: '#22d3ee',
  daily: '#facc15',
  referral: '#22c55e',
  video: '#a855f7',
  special: '#ef4444',
};

export default function TasksPage() {
  const { user, refreshBalance } = useApp();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<string | null>(null);
  const [message, setMessage] = useState<{ id: string; text: string; success: boolean } | null>(null);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    const [allTasks, userTasksList] = await Promise.all([
      getTasks(),
      user ? getUserTasks(user.id) : Promise.resolve([]),
    ]);
    setTasks(allTasks);
    const ids = new Set((userTasksList as Array<{ task_id: string }>).map(ut => ut.task_id));
    setCompletedTaskIds(ids);
  }

  async function handleComplete(task: Task) {
    if (!user) return;

    triggerHaptic();
    setCompleting(task.id);

    if (task.link) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(task.link);
      } else {
        window.open(task.link, '_blank');
      }
    }

    const result = await completeTask(user.id, task.id);

    if (result.success) {
      triggerHaptic('success');
      setMessage({ id: task.id, text: `+${result.points} pts earned! 🎉`, success: true });
      setCompletedTaskIds(prev => new Set([...prev, task.id]));
      await refreshBalance();
    } else {
      triggerHaptic('error');
      setMessage({ id: task.id, text: result.message || 'Task failed', success: false });
    }

    setCompleting(null);
    setTimeout(() => setMessage(null), 3000);
  }

  const filters = ['all', 'social', 'daily', 'referral', 'video', 'special'];
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.task_type === filter);

  return (
    <div className="px-4 pb-28 text-white">

      {/* HEADER */}
      <div className="mb-6">
        <h2 className="text-xl font-bold">Tasks</h2>
        <p className="text-xs text-gray-400">Complete tasks & earn rewards</p>
      </div>

      {/* FILTERS */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => {
              triggerHaptic();
              setFilter(f);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-all active:scale-95"
            style={{
              background: filter === f
                ? 'linear-gradient(135deg,#facc15,#f97316)'
                : '#111827',
              color: filter === f ? '#111' : '#9ca3af',
              boxShadow: filter === f
                ? '0 10px 20px rgba(250,204,21,0.3)'
                : 'none',
            }}
          >
            {f}
          </button>
        ))}
      </div>

      {/* TASK LIST */}
      <div className="space-y-4">
        {filtered.map(task => {
          const isCompleted = completedTaskIds.has(task.id) && !task.is_repeatable;
          const isCompleting = completing === task.id;
          const color = TASK_COLORS[task.task_type] || '#facc15';

          return (
            <div
              key={task.id}
              className="rounded-3xl p-5 relative overflow-hidden transition-all active:scale-[0.98]"
              style={{
                background: 'linear-gradient(145deg,#0f172a,#1e293b)',
                border: `1px solid ${color}40`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              {/* Glow top highlight */}
              <div
                className="absolute top-0 left-0 w-full h-1"
                style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
              />

              <div className="flex items-center gap-4">

                {/* Icon */}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${color}20`,
                    border: `1px solid ${color}50`,
                    boxShadow: `0 0 20px ${color}30`,
                  }}
                >
                  {task.icon || '✨'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">
                    {task.title}
                  </div>

                  {task.description && (
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {task.description}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2 text-xs">
                    <span className="font-bold text-yellow-400">
                      +{task.reward_points.toLocaleString()} pts
                    </span>

                    {task.reward_stars > 0 && (
                      <span className="font-bold text-cyan-400">
                        +{task.reward_stars} ⭐
                      </span>
                    )}

                    <span
                      className="px-2 py-0.5 rounded-lg capitalize"
                      style={{
                        background: `${color}20`,
                        color,
                      }}
                    >
                      {task.task_type}
                    </span>
                  </div>
                </div>

                {/* BUTTON */}
                <button
                  disabled={isCompleted || isCompleting}
                  onClick={() => !isCompleted && handleComplete(task)}
                  className="px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                  style={{
                    background: isCompleted
                      ? '#1f2937'
                      : `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: isCompleted ? '#6b7280' : '#111',
                    boxShadow: isCompleted ? 'none' : `0 10px 20px ${color}40`,
                    opacity: isCompleting ? 0.7 : 1,
                  }}
                >
                  {isCompleted ? '✓ Done' : isCompleting ? '...' : 'Start'}
                </button>
              </div>

              {/* MESSAGE */}
              {message?.id === task.id && (
                <div
                  className="mt-4 text-xs font-semibold text-center py-2 rounded-xl animate-pulse"
                  style={{
                    background: message.success
                      ? 'rgba(34,197,94,0.15)'
                      : 'rgba(239,68,68,0.15)',
                    color: message.success
                      ? '#22c55e'
                      : '#ef4444',
                  }}
                >
                  {message.text}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center text-gray-500 py-12">
          <div className="text-4xl mb-3">📋</div>
          No tasks here
        </div>
      )}
    </div>
  );
}
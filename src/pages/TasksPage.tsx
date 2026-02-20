import React, { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { getTasks, getUserTasks, completeTask } from '@/lib/api';
import { Task } from '@/types/telegram';

const TASK_COLORS: Record<string, string> = {
  social: 'hsl(190 100% 55%)',
  daily: 'hsl(45 100% 55%)',
  referral: 'hsl(140 70% 50%)',
  video: 'hsl(265 80% 65%)',
  special: 'hsl(0 80% 60%)',
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
    setCompleting(task.id);
    
    // Open link if exists
    if (task.link) {
      if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.openTelegramLink(task.link);
      } else {
        window.open(task.link, '_blank');
      }
    }

    // Complete task
    const result = await completeTask(user.id, task.id);
    if (result.success) {
      setMessage({ id: task.id, text: `+${result.points} pts earned! 🎉`, success: true });
      setCompletedTaskIds(prev => new Set([...prev, task.id]));
      await refreshBalance();
    } else {
      setMessage({ id: task.id, text: result.message || 'Task failed', success: false });
    }
    setCompleting(null);
    setTimeout(() => setMessage(null), 3000);
  }

  const filters = ['all', 'social', 'daily', 'referral', 'video', 'special'];
  const filtered = filter === 'all' ? tasks : tasks.filter(t => t.task_type === filter);

  return (
    <div className="px-4 pb-28">
      <div className="mb-4">
        <h2 className="text-lg font-display font-bold text-gold-gradient mb-1">Tasks</h2>
        <p className="text-xs text-muted-foreground">Complete tasks to earn points & rewards</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === f ? 'hsl(45 100% 55%)' : 'hsl(220 25% 10%)',
              color: filter === f ? 'hsl(220 30% 5%)' : 'hsl(220 15% 60%)',
              border: `1px solid ${filter === f ? 'transparent' : 'hsl(220 20% 15%)'}`,
            }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      <div className="space-y-3">
        {filtered.map(task => {
          const isCompleted = completedTaskIds.has(task.id) && !task.is_repeatable;
          const isCompleting = completing === task.id;
          const color = TASK_COLORS[task.task_type] || 'hsl(45 100% 55%)';

          return (
            <div key={task.id} className="task-item p-4">
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                  style={{
                    background: `${color}15`,
                    border: `1px solid ${color}30`,
                  }}
                >
                  {task.icon || '✨'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{task.title}</div>
                  {task.description && (
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{task.description}</div>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold" style={{ color: 'hsl(45 100% 55%)' }}>
                      +{task.reward_points.toLocaleString()} pts
                    </span>
                    {task.reward_stars > 0 && (
                      <span className="text-xs font-bold" style={{ color: 'hsl(190 100% 55%)' }}>
                        +{task.reward_stars} ⭐
                      </span>
                    )}
                    <span
                      className="text-xs px-1.5 py-0.5 rounded capitalize"
                      style={{ background: `${color}20`, color }}
                    >
                      {task.task_type}
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <button
                  className="px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: isCompleted
                      ? 'hsl(220 20% 15%)'
                      : `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: isCompleted ? 'hsl(220 15% 50%)' : 'hsl(220 30% 5%)',
                    opacity: isCompleting ? 0.7 : 1,
                  }}
                  disabled={isCompleted || isCompleting}
                  onClick={() => !isCompleted && handleComplete(task)}
                >
                  {isCompleted ? '✓ Done' : isCompleting ? '...' : '▶ Go'}
                </button>
              </div>

              {/* Feedback message */}
              {message?.id === task.id && (
                <div
                  className="mt-2 text-xs font-medium text-center py-1.5 rounded-lg"
                  style={{
                    background: message.success ? 'hsl(140 70% 50% / 0.15)' : 'hsl(0 80% 55% / 0.15)',
                    color: message.success ? 'hsl(140 70% 50%)' : 'hsl(0 80% 60%)',
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
        <div className="text-center text-muted-foreground py-10">
          <div className="text-3xl mb-2">📋</div>
          <div className="text-sm">No tasks in this category</div>
        </div>
      )}
    </div>
  );
}

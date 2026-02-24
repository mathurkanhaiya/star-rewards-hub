import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // HAPTIC
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error') => {
    if (window.Telegram?.WebApp?.HapticFeedback) {
      if (type === 'success') window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
      else window.Telegram.WebApp.HapticFeedback.impactOccurred(type);
    }
  };

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

    triggerHaptic('medium');
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
      setMessage({ id: task.id, text: `+${result.points} pts earned! 🚀`, success: true });
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
    <div className="px-4 pb-28 relative">
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h2 className="text-xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
          Missions
        </h2>
        <p className="text-xs text-muted-foreground">
          Complete missions. Earn rewards. Level up.
        </p>
      </motion.div>

      {/* FILTERS */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-6 no-scrollbar">
        {filters.map(f => (
          <motion.button
            key={f}
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.05 }}
            onClick={() => {
              triggerHaptic('light');
              setFilter(f);
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold capitalize relative"
            style={{
              background:
                filter === f
                  ? 'linear-gradient(135deg, #facc15, #fb923c)'
                  : 'rgba(255,255,255,0.05)',
              color: filter === f ? '#111' : '#aaa',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            {f}
          </motion.button>
        ))}
      </div>

      {/* TASKS */}
      <div className="space-y-5" style={{ perspective: 1200 }}>
        <AnimatePresence>
          {filtered.map(task => {
            const isCompleted = completedTaskIds.has(task.id) && !task.is_repeatable;
            const isCompleting = completing === task.id;
            const color = TASK_COLORS[task.task_type] || 'hsl(45 100% 55%)';

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 30, rotateX: -10 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                exit={{ opacity: 0, y: -20 }}
                whileHover={{ rotateX: 5, rotateY: -5 }}
                transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                className="relative p-5 rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(20,20,25,0.6)',
                  backdropFilter: 'blur(20px)',
                  border: `1px solid ${color}30`,
                  boxShadow: `0 10px 30px ${color}20`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Glow */}
                <div
                  className="absolute inset-0 opacity-20 blur-2xl"
                  style={{ background: color }}
                />

                <div className="relative flex items-center gap-4 z-10">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                    style={{
                      background: `${color}20`,
                      border: `1px solid ${color}40`,
                    }}
                  >
                    {task.icon || '✨'}
                  </div>

                  <div className="flex-1">
                    <div className="font-semibold text-sm">{task.title}</div>
                    {task.description && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {task.description}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-2 text-xs font-bold">
                      <span style={{ color }}>
                        +{task.reward_points.toLocaleString()} pts
                      </span>
                      {task.reward_stars > 0 && (
                        <span className="text-cyan-400">
                          +{task.reward_stars} ⭐
                        </span>
                      )}
                    </div>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.85 }}
                    disabled={isCompleted || isCompleting}
                    onClick={() => !isCompleted && handleComplete(task)}
                    className="px-4 py-2 rounded-xl text-xs font-bold"
                    style={{
                      background: isCompleted
                        ? 'rgba(255,255,255,0.08)'
                        : `linear-gradient(135deg, ${color}, ${color}cc)`,
                      color: isCompleted ? '#777' : '#111',
                      opacity: isCompleting ? 0.6 : 1,
                    }}
                  >
                    {isCompleted ? '✓ Done' : isCompleting ? '...' : 'Go'}
                  </motion.button>
                </div>

                {/* Animated feedback */}
                <AnimatePresence>
                  {message?.id === task.id && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-3 text-xs font-medium text-center py-2 rounded-xl"
                      style={{
                        background: message.success
                          ? 'rgba(34,197,94,0.15)'
                          : 'rgba(239,68,68,0.15)',
                        color: message.success
                          ? 'rgb(34,197,94)'
                          : 'rgb(239,68,68)',
                      }}
                    >
                      {message.text}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center text-muted-foreground py-16"
        >
          <div className="text-4xl mb-3">📭</div>
          <div className="text-sm">No missions available</div>
        </motion.div>
      )}
    </div>
  );
}
import React, { useEffect, useState, useRef } from 'react';
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

  /* ===============================
     AD REFS
  =================================*/
  const nativeAdRef = useRef<HTMLDivElement | null>(null);
  const bannerAdRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {

  /* -------- Native Ad -------- */
  if (nativeAdRef.current) {

    const container = document.createElement("div");
    container.id = "container-1b89685908e0ae9bf3327082f3d0a363";

    const script = document.createElement("script");
    script.src = "https://pl28904350.effectivegatecpm.com/1b89685908e0ae9bf3327082f3d0a363/invoke.js";
    script.async = true;
    script.setAttribute("data-cfasync", "false");

    nativeAdRef.current.appendChild(script);
    nativeAdRef.current.appendChild(container);
  }

  /* -------- 320x50 Banner -------- */
  if (bannerAdRef.current) {

    const config = document.createElement("script");
    config.innerHTML = `
      atOptions = {
        'key' : '51ed0e5213d1e44096de5736dd56a99e',
        'format' : 'iframe',
        'height' : 50,
        'width' : 320,
        'params' : {}
      };
    `;

    const script = document.createElement("script");
    script.src = "https://www.highperformanceformat.com/51ed0e5213d1e44096de5736dd56a99e/invoke.js";
    script.async = true;

    bannerAdRef.current.appendChild(config);
    bannerAdRef.current.appendChild(script);
  }

}, []);

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

      {/* NATIVE AD */}
      <div
        ref={nativeAdRef}
        style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}
      />

      {/* TASK LIST */}
      <div className="space-y-4">
        {filtered.map(task => {
          const isCompleted = completedTaskIds.has(task.id) && !task.is_repeatable;
          const isCompleting = completing === task.id;
          const color = TASK_COLORS[task.task_type] || '#facc15';

          return (
            <div
              key={task.id}
              className="rounded-3xl p-5 relative overflow-hidden"
              style={{
                background: 'linear-gradient(145deg,#0f172a,#1e293b)',
                border: `1px solid ${color}40`,
              }}
            >
              <div className="flex items-center gap-4">

                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                  style={{
                    background: `${color}20`,
                    border: `1px solid ${color}50`,
                  }}
                >
                  {task.icon || '✨'}
                </div>

                <div className="flex-1">
                  <div className="font-semibold text-sm">{task.title}</div>

                  <div className="text-xs text-gray-400 mt-1">
                    {task.description}
                  </div>

                  <div className="text-xs text-yellow-400 mt-2 font-bold">
                    +{task.reward_points} pts
                  </div>
                </div>

                <button
                  disabled={isCompleted || isCompleting}
                  onClick={() => handleComplete(task)}
                  className="px-4 py-2 rounded-xl text-xs font-bold"
                  style={{
                    background: isCompleted
                      ? '#1f2937'
                      : `linear-gradient(135deg, ${color}, ${color}cc)`,
                    color: '#111'
                  }}
                >
                  {isCompleted ? '✓ Done' : 'Start'}
                </button>

              </div>
            </div>
          );
        })}
      </div>

      {/* 320x50 BANNER */}
      <div
        ref={bannerAdRef}
        style={{ display: "flex", justifyContent: "center", marginTop: "20px" }}
      />

    </div>
  );
}
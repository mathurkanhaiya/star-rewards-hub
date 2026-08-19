import type { Task } from '@/types/telegram';

const RESERVED_TELEGRAM_PATHS = new Set(['addlist', 'c', 'contact', 'joinchat', 'login', 'proxy', 'share']);

export function getTaskProfileImage(task: Pick<Task, 'icon' | 'link'>): string | null {
  const configured = task.icon?.trim();
  if (configured && /^https?:\/\//i.test(configured)) return configured;

  const link = task.link?.trim();
  if (!link) return null;

  try {
    const url = new URL(link);
    if (url.protocol === 'tg:' && url.hostname === 'resolve') {
      const domain = url.searchParams.get('domain')?.replace(/^@/, '');
      return domain ? `https://t.me/i/userpic/320/${encodeURIComponent(domain)}.jpg` : null;
    }

    if (!['t.me', 'telegram.me', 'www.t.me', 'www.telegram.me'].includes(url.hostname.toLowerCase())) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    const candidate = parts[0] === 's' ? parts[1] : parts[0];
    if (!candidate || candidate.startsWith('+') || RESERVED_TELEGRAM_PATHS.has(candidate.toLowerCase())) return null;
    return `https://t.me/i/userpic/320/${encodeURIComponent(candidate.replace(/^@/, ''))}.jpg`;
  } catch {
    return null;
  }
}

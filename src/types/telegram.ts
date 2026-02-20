// Telegram WebApp SDK types
export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: {
    user?: TelegramUser;
    start_param?: string;
    hash?: string;
  };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: {
    bg_color?: string;
    text_color?: string;
    hint_color?: string;
    link_color?: string;
    button_color?: string;
    button_text_color?: string;
  };
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  ready: () => void;
  expand: () => void;
  close: () => void;
  MainButton: {
    text: string;
    color: string;
    textColor: string;
    isVisible: boolean;
    isActive: boolean;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (callback: () => void) => void;
  };
  HapticFeedback: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  openLink: (url: string) => void;
  openTelegramLink: (url: string) => void;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp: TelegramWebApp;
    };
  }
}

export interface AppUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
  level: number;
  total_points: number;
  referral_code: string;
  referred_by: number | null;
  is_banned: boolean;
  last_active_at: string;
  created_at: string;
}

export interface UserBalance {
  id: string;
  user_id: string;
  points: number;
  stars_balance: number;
  usdt_balance: number;
  ton_balance: number;
  total_earned: number;
  total_withdrawn: number;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  reward_points: number;
  reward_stars: number;
  link: string | null;
  icon: string | null;
  is_active: boolean;
  is_repeatable: boolean;
  display_order: number;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  method: string;
  points_spent: number;
  amount: number;
  wallet_address: string | null;
  status: string;
  admin_note: string | null;
  requested_at: string;
  processed_at: string | null;
  created_at: string;
}

export interface LeaderboardEntry {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  photo_url: string | null;
  level: number;
  total_points: number;
  current_points: number;
  rank: number;
}

export interface AppSettings {
  points_per_referral: number;
  min_withdrawal_points: number;
  stars_conversion_rate: number;
  usdt_conversion_rate: number;
  ton_conversion_rate: number;
  daily_bonus_base: number;
  spin_cost_points: number;
  maintenance_mode: boolean;
  max_daily_spins: number;
  referral_bonus_referred: number;
}

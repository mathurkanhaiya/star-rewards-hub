# ADS Rewards - Telegram Mini App

## Overview
A Telegram Web App (Mini App) for earning points through tasks, daily rewards, spin wheel, referrals, games, and watching ads. Users can withdraw earnings via TON or UPI.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS + Radix UI (shadcn/ui components)
- **Database & Auth**: Supabase (PostgreSQL + Row Level Security + Realtime)
- **Backend Logic**: Supabase Edge Functions (Deno) for sensitive operations
- **Telegram Integration**: Telegram Web App SDK for user auth and haptics

## Project Structure
```
src/
  App.tsx              # Main app with loading/banned screen logic
  context/
    AppContext.tsx     # Global state (user, balance, settings, notifications)
  lib/
    api.ts             # All Supabase DB and Edge Function calls
  pages/               # Page components (Home, Tasks, Spin, Wallet, Admin, etc.)
  components/          # Shared UI components
  hooks/               # useAdsgram, use-toast, use-mobile
  types/
    telegram.ts        # TypeScript types for all data models
  integrations/
    supabase/          # Auto-generated Supabase client + types
supabase/
  functions/           # Edge Functions (Deno): telegram-auth, complete-task,
                       # daily-reward, spin-wheel, withdraw, admin-withdrawal,
                       # log-ad, distribute-contest, get-custom-emoji, telegram-bot
  migrations/          # All database migrations (schema)
```

## Key Features
- Telegram user authentication via Edge Function
- Daily reward claim with streak tracking
- Spin wheel (3 spins/day, random prizes)
- Task system (social, referral, video tasks)
- Referral system with bonus points
- Games: Tower Climb, Lucky Box, Dice Roll, Card Flip, Number Guess
- Contest/leaderboard system
- Withdrawal via TON wallet or UPI ID
- Admin panel for managing users, tasks, withdrawals, contests
- Real-time balance + notification updates via Supabase Realtime
- Ad integration via Adsgram

## Environment Variables Required
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/public key

## Supabase Edge Functions Required
The following Edge Functions must be deployed to your Supabase project:
- `telegram-auth` — User login/registration
- `complete-task` — Task completion with verification
- `daily-reward` — Daily check-in
- `spin-wheel` — Wheel spin with prize logic
- `withdraw` — Withdrawal request handling
- `admin-withdrawal` — Admin approve/reject withdrawals
- `log-ad` — Ad watch logging and rewards
- `distribute-contest` — Contest prize distribution
- `get-custom-emoji` — Telegram custom emoji fetching
- `telegram-bot` — Telegram bot webhook handler

## Development Notes
- The app falls back to a mock admin user (ID: 2139807311) when run outside Telegram
- All sensitive operations run server-side in Supabase Edge Functions
- The UI is dark-themed (#06080f background) — this is by design
- Port 5000 is used for development (required for Replit webview)

## Running
```bash
npm run dev    # Start development server on port 5000
npm run build  # Build for production
```

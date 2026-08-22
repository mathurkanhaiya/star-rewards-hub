// Deployed source of the AdsReward ephemeral /help handler.
// The production function is managed in Supabase and routes /help + help:* callbacks,
// keeps one help message per chat, uses WebApp ?page= deep links, and expires after 5 minutes.
// See migration 20260822081827_telegram_ephemeral_help_messages.sql for storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") || Deno.env.get("TELEGRAM_BOT_TOKEN")

serve(async (req) => {
  if (!BOT_TOKEN) {
    console.error("BOT_TOKEN not set")
    return new Response("Bot token missing")
  }

  const update = await req.json()
  if (!update.message) return new Response("ok")

  const chatId = update.message.chat.id
  const text = update.message.text

  if (text === "/test") {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: "Welcome to Ads Rewards Bot 🚀" })
    })
  }

  return new Response("ok")
})
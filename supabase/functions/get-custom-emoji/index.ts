import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// In-memory cache for emoji URLs (persists across warm invocations)
const emojiCache = new Map<string, { url: string; expires: number }>();
const CACHE_TTL = 3600 * 1000; // 1 hour

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { custom_emoji_ids } = await req.json();
    
    if (!custom_emoji_ids || !Array.isArray(custom_emoji_ids) || custom_emoji_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'custom_emoji_ids array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    if (!BOT_TOKEN) {
      throw new Error('TELEGRAM_BOT_TOKEN not configured');
    }

    const now = Date.now();
    const results: Record<string, string> = {};
    const uncachedIds: string[] = [];

    // Check cache first
    for (const id of custom_emoji_ids) {
      const cached = emojiCache.get(id);
      if (cached && cached.expires > now) {
        results[id] = cached.url;
      } else {
        uncachedIds.push(id);
      }
    }

    // Fetch uncached emoji from Telegram Bot API
    if (uncachedIds.length > 0) {
      const resp = await fetch(
        `https://api.telegram.org/bot${BOT_TOKEN}/getCustomEmojiStickers`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ custom_emoji_ids: uncachedIds }),
        }
      );

      const data = await resp.json();
      
      if (!data.ok) {
        console.error('Telegram API error:', data);
        return new Response(JSON.stringify({ error: 'Failed to fetch emoji', details: data.description }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For each sticker, get the file URL
      for (const sticker of data.result) {
        const fileResp = await fetch(
          `https://api.telegram.org/bot${BOT_TOKEN}/getFile`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_id: sticker.thumbnail?.file_id || sticker.file_id }),
          }
        );
        
        const fileData = await fileResp.json();
        
        if (fileData.ok && fileData.result.file_path) {
          const url = `https://api.telegram.org/file/bot${BOT_TOKEN}/${fileData.result.file_path}`;
          const emojiId = sticker.custom_emoji_id;
          results[emojiId] = url;
          emojiCache.set(emojiId, { url, expires: now + CACHE_TTL });
        }
      }
    }

    return new Response(JSON.stringify({ emojis: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

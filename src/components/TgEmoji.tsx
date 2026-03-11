import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Global client-side cache
const emojiUrlCache = new Map<string, string>();
const pendingRequests = new Map<string, Promise<string | null>>();

async function fetchEmojiUrl(id: string): Promise<string | null> {
  // Check cache
  if (emojiUrlCache.has(id)) {
    return emojiUrlCache.get(id)!;
  }

  // Deduplicate in-flight requests
  if (pendingRequests.has(id)) {
    return pendingRequests.get(id)!;
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("get-custom-emoji", {
        body: { custom_emoji_ids: [id] },
      });

      if (error || !data?.emojis?.[id]) {
        console.warn("Failed to fetch emoji", id, error);
        return null;
      }

      const url = data.emojis[id];
      emojiUrlCache.set(id, url);
      return url;
    } catch (err) {
      console.warn("Emoji fetch error:", err);
      return null;
    } finally {
      pendingRequests.delete(id);
    }
  })();

  pendingRequests.set(id, promise);
  return promise;
}

interface TgEmojiProps {
  id: string;
  size?: number;
  fallback?: string;
}

export default function TgEmoji({ id, size = 20, fallback = "⭐" }: TgEmojiProps) {
  const [url, setUrl] = useState<string | null>(emojiUrlCache.get(id) || null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url) return;

    fetchEmojiUrl(id).then((result) => {
      if (result) {
        setUrl(result);
      } else {
        setFailed(true);
      }
    });
  }, [id, url]);

  if (failed || !url) {
    return <span style={{ fontSize: size * 0.8, lineHeight: 1 }}>{fallback}</span>;
  }

  // Telegram sticker thumbnails are usually WebP images
  return (
    <img
      src={url}
      alt="emoji"
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "inline-block",
        verticalAlign: "middle",
      }}
      onError={() => setFailed(true)}
    />
  );
}

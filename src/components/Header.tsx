import React from "react";
import { useApp } from "@/context/AppContext";
import TgEmoji from "@/components/TgEmoji";

function getLevelInfo(level: number) {
  const levels = [
    { name: "Beginner", color: "hsl(200 60% 65%)", min: 1, max: 2 },
    { name: "Rookie", color: "hsl(215 70% 60%)", min: 3, max: 4 },
    { name: "Iron", color: "hsl(210 10% 50%)", min: 5, max: 6 },
    { name: "Bronze", color: "hsl(25 80% 55%)", min: 7, max: 9 },
    { name: "Silver", color: "hsl(0 0% 70%)", min: 10, max: 13 },
    { name: "Gold", color: "hsl(45 100% 55%)", min: 14, max: 18 },
    { name: "Platinum", color: "hsl(190 80% 60%)", min: 19, max: 24 },
    { name: "Diamond", color: "hsl(265 80% 70%)", min: 25, max: 35 },
    { name: "Master", color: "hsl(280 70% 60%)", min: 36, max: 50 },
    { name: "Legend", color: "hsl(0 90% 60%)", min: 51, max: 99 },
  ];

  return levels.find((l) => level >= l.min && level <= l.max) || levels[0];
}


export default function Header() {
  const { user, balance, telegramUser } = useApp();

  const levelInfo = getLevelInfo(user?.level || 1);

  const displayName =
    user?.first_name ||
    telegramUser?.first_name ||
    "User";

  const points = balance?.points || 0;

  return (
    <div className="px-4 pt-4 pb-2">

      <div className="flex items-center justify-between mb-4">

        <div className="flex items-center gap-3">

          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold relative"
            style={{
              background: `linear-gradient(135deg, ${levelInfo.color}, hsl(220 30% 20%))`,
              boxShadow: `0 0 15px ${levelInfo.color}40`,
            }}
          >
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={displayName}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span>{displayName[0]?.toUpperCase()}</span>
            )}

            <div
              className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
              style={{
                background: levelInfo.color,
                color: "hsl(220 30% 5%)",
                fontSize: 9,
              }}
            >
              {user?.level || 1}
            </div>
          </div>

          {/* Name + Level */}
          <div>
            <div className="text-sm font-semibold text-foreground">
              {displayName}
              {user?.username && (
                <span className="text-muted-foreground font-normal">
                  {" "}@{user.username}
                </span>
              )}
            </div>

            <div
              className="text-xs font-medium flex items-center gap-1"
              style={{ color: levelInfo.color }}
            >
              ⭐

            </div>
          </div>
        </div>

        {/* Points */}
        <div
          className="px-3 py-1.5 rounded-xl text-sm font-bold flex items-center gap-1"
          style={{
            background:
              "linear-gradient(135deg, hsl(45 100% 55% / 0.15), hsl(45 100% 55% / 0.05))",
            border: "1px solid hsl(45 100% 55% / 0.3)",
            color: "hsl(var(--gold))",
          }}
        >
          🪙
          {points.toLocaleString()}
        </div>

      </div>

      {/* Title */}
      <div className="text-center mb-1">
        <h1 className="text-lg font-display font-bold tracking-wider">
          ADS REWARDS
        </h1>
      </div>

    </div>
  );
}
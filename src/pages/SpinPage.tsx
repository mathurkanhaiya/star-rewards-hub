import React, { useState } from "react";

const SEGMENTS = [
  { label: "💰 100", type: "points", value: 100 },
  { label: "💎 250", type: "points", value: 250 },
  { label: "🌟 1 Star", type: "stars", value: 1 },
  { label: "💰 500", type: "points", value: 500 },
  { label: "💎 750", type: "points", value: 750 },
  { label: "🌟 2 Stars", type: "stars", value: 2 },
  { label: "💰 1000", type: "points", value: 1000 },
  { label: "🎯 Try Again", type: "empty", value: 0 },
];

const segmentColors = [
  "linear-gradient(145deg,#1e293b,#0f172a)",
  "linear-gradient(145deg,#7c3aed,#4c1d95)",
  "linear-gradient(145deg,#0ea5e9,#0369a1)",
  "linear-gradient(145deg,#f59e0b,#b45309)",
  "linear-gradient(145deg,#22c55e,#14532d)",
  "linear-gradient(145deg,#06b6d4,#164e63)",
  "linear-gradient(145deg,#eab308,#854d0e)",
  "linear-gradient(145deg,#ef4444,#7f1d1d)",
];

export default function PremiumSpinner() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const segmentAngle = 360 / SEGMENTS.length;

  const spin = () => {
    if (spinning) return;

    setSpinning(true);
    setResult(null);

    const targetIndex = Math.floor(Math.random() * SEGMENTS.length);

    const spinRounds = 6;
    const targetAngle =
      360 * spinRounds +
      (360 - targetIndex * segmentAngle - segmentAngle / 2);

    setRotation(prev => prev + targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setResult(`You won ${SEGMENTS[targetIndex].label}! 🎉`);
    }, 4500);
  };

  return (
    <div className="flex flex-col items-center justify-center py-10">
      
      {/* Pointer */}
      <div
        style={{
          width: 0,
          height: 0,
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderTop: "26px solid gold",
          filter: "drop-shadow(0 0 10px gold)",
          marginBottom: "-10px",
          zIndex: 10,
        }}
      />

      {/* Wheel */}
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: "50%",
          position: "relative",
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 4.5s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
            : "none",
          boxShadow:
            "0 20px 40px rgba(0,0,0,0.6), inset 0 0 40px rgba(255,255,255,0.1)",
          background: "radial-gradient(circle at 30% 30%, #ffffff22, #00000055)",
        }}
      >
        {SEGMENTS.map((segment, i) => {
          const angle = i * segmentAngle;

          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: "50%",
                height: "50%",
                top: "50%",
                left: "50%",
                transformOrigin: "0% 0%",
                transform: `rotate(${angle}deg) skewY(${90 - segmentAngle}deg)`,
                background: segmentColors[i],
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{
                  transform: `skewY(-${90 - segmentAngle}deg) rotate(${segmentAngle/2}deg)`,
                  position: "absolute",
                  top: "30%",
                  left: "-100%",
                  width: "200%",
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                  color: "white",
                  textShadow: "0 0 10px rgba(0,0,0,0.7)",
                }}
              >
                {segment.label}
              </div>
            </div>
          );
        })}

        {/* Center Hub */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 30% 30%, #facc15, #b45309)",
            boxShadow:
              "0 0 20px rgba(255,215,0,0.8), inset 0 0 10px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "30px",
          }}
        >
          🎡
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 text-lg font-bold text-yellow-400 animate-pulse">
          {result}
        </div>
      )}

      {/* Button */}
      <button
        onClick={spin}
        disabled={spinning}
        className="mt-6 px-8 py-3 rounded-2xl font-bold text-lg"
        style={{
          background:
            "linear-gradient(135deg,#facc15,#f97316)",
          boxShadow: "0 10px 25px rgba(0,0,0,0.4)",
          transform: spinning ? "scale(0.95)" : "scale(1)",
          transition: "0.2s",
        }}
      >
        {spinning ? "🌀 Spinning..." : "SPIN NOW"}
      </button>
    </div>
  );
}
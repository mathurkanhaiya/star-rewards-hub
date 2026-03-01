import React from 'react';

export default function Maintenance() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center bg-black">
      <div className="max-w-md w-full">
        <div className="text-6xl mb-6 animate-pulse">🚧</div>

        <h1 className="text-3xl font-black mb-4 text-white">
          Opening Soon
        </h1>

        <p className="text-sm text-gray-400 mb-6">
          We're upgrading the mine and making things better.
          Please check back shortly.
        </p>

        <div className="glass-card rounded-2xl p-4 border border-yellow-500/30">
          <div className="text-xs text-yellow-400 uppercase tracking-wider mb-2">
            Maintenance Mode
          </div>
          <div className="text-sm text-gray-300">
            Servers are temporarily offline.
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          © {new Date().getFullYear()} Idle Miner
        </div>
      </div>
    </div>
  );
}
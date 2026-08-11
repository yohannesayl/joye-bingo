import React, { useState, useEffect } from 'react';
import { ArrowRight, Users, Flame, Shield, Sparkles } from 'lucide-react';
import { sound } from '../services/soundService';

export default function Lobby({ rooms, onJoinRoom, globalMasterSeconds }) {
  const defaultStakes = [
    { id: 'room_10', stake: 10, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_20', stake: 20, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_30', stake: 30, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_50', stake: 50, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_80', stake: 80, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_100', stake: 100, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_150', stake: 150, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_200', stake: 200, bonus: 'T 0 (+100 ETB)' },
    { id: 'room_300', stake: 300, bonus: 'T 0 (+100 ETB)' },
  ];

  // Map room data from socket
  const roomMap = {};
  (rooms || []).forEach(r => {
    roomMap[r.id] = r;
  });

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#241338]/90 border border-purple-800/80 rounded-3xl p-5 sm:p-6 text-center space-y-3 shadow-2xl">
        <span className="inline-block px-4 py-1 rounded-full bg-yellow-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow">
          JOYE BINGO • REALTIME ETHIOPIAN MATCHES
        </span>
        <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
          Select Your Stake & Join Game
        </h2>
        <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto">
          Possible win increases dynamically based on joined players! Join with 2+ players, pick cards 1 to 252, and hit <strong>Bingo</strong> to win cash!
        </p>
      </div>

      {/* Stake Selection Table matching Screenshot 1 */}
      <div className="bg-[#241338]/95 border-2 border-purple-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
        
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-2 text-center text-xs font-extrabold text-slate-300 border-b border-purple-800/60 pb-3 uppercase tracking-wider">
          <div className="col-span-3 text-left pl-3">Stake</div>
          <div className="col-span-3">Active (Status)</div>
          <div className="col-span-3">Possible Win</div>
          <div className="col-span-3">Join</div>
        </div>

        {/* Stake Rows */}
        <div className="space-y-3">
          {defaultStakes.map(({ id, stake, bonus }) => {
            const liveRoom = roomMap[id] || {};
            const status = liveRoom.status || 'COUNTDOWN';
            const seconds = (liveRoom.countdownSeconds !== undefined && liveRoom.countdownSeconds > 0) ? liveRoom.countdownSeconds : (globalMasterSeconds || 45);
            const pot = liveRoom.pot || (stake * 2 * 0.85);
            const playerCount = liveRoom.playerCount || 0;

            return (
              <div
                key={id}
                className="ahun-table-row grid grid-cols-12 items-center gap-2 px-3 sm:px-4 py-3 border border-purple-700/50 shadow-md transition-all hover:scale-[1.01]"
              >
                {/* Stake Column */}
                <div className="col-span-3 space-y-1">
                  <span className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                    {stake}birr
                    {playerCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-950 text-yellow-400 text-[10px] font-mono border border-purple-700">
                        👤 {playerCount}
                      </span>
                    )}
                  </span>
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-900/60 text-yellow-400 text-[10px] font-mono border border-purple-900">
                    {bonus}
                  </span>
                </div>

                {/* ACTIVE TIMER / STATUS COLUMN */}
                <div className="col-span-3 text-center">
                  {status === 'PLAYING' ? (
                    <span className="text-emerald-400 font-black text-sm uppercase tracking-widest animate-pulse font-mono">
                      ⚡ PLAYING
                    </span>
                  ) : (
                    <span className="digital-clock-red text-xl sm:text-2xl font-mono">
                      0:{seconds < 10 ? '0' : ''}{seconds}
                    </span>
                  )}
                </div>

                {/* DYNAMIC POSSIBLE WIN COLUMN (Based on joined players & cards!) */}
                <div className="col-span-3 text-center">
                  <span className="text-xs sm:text-sm font-black text-yellow-400 font-mono">
                    ↑ {pot} Birr
                  </span>
                </div>

                {/* Join Button Column */}
                <div className="col-span-3 text-right pr-1">
                  <button
                    onClick={() => {
                      sound.playClick();
                      onJoinRoom(id);
                    }}
                    className="ahun-yellow-btn px-4 sm:px-6 py-2 text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-1 mx-auto"
                  >
                    <span>Join</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Flame, History, Award, Sparkles } from 'lucide-react';
import { sound } from '../services/soundService';

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      setLeaders(data.leaderboard || []);
      setRecentGames(data.recentGames || []);
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-amber-500/30 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
          <Trophy className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-2xl font-extrabold text-white">Top Karta Champions</h2>
          <p className="text-xs text-slate-400">All-time top winners and recent match payouts</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top 10 Champions Table */}
        <div className="lg:col-span-2 glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-lg font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <Award className="w-5 h-5 text-amber-400" />
            Top 10 Player Rankings
          </h3>

          <div className="space-y-2">
            {leaders.map((player, index) => {
              const isTop3 = index < 3;
              const medalColors = ['text-amber-400', 'text-slate-300', 'text-amber-600'];

              return (
                <div
                  key={player.id}
                  className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all ${
                    isTop3
                      ? 'bg-slate-950/80 border-amber-500/30 shadow-md'
                      : 'bg-slate-950/40 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-extrabold text-xs">
                      {isTop3 ? (
                        <Medal className={`w-5 h-5 ${medalColors[index]}`} />
                      ) : (
                        <span className="text-slate-400">#{index + 1}</span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-white">{player.displayName || player.username}</h4>
                      <p className="text-[10px] text-slate-400">{player.totalWins} Wins • {player.gamesPlayed} Matches</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="font-black text-sm text-emerald-400">{player.totalEarned} ETB</p>
                    <p className="text-[10px] text-slate-400 font-semibold">Total Won</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Game Winners Feed */}
        <div className="glass-card p-6 rounded-3xl border border-slate-800 space-y-4">
          <h3 className="text-base font-extrabold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
            <History className="w-4 h-4 text-amber-400" />
            Live Winner Feed
          </h3>

          <div className="space-y-3">
            {recentGames.map((game) => (
              <div key={game.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <div className="flex items-center justify-between font-bold text-white">
                  <span>{game.winnerName}</span>
                  <span className="text-emerald-400 font-black">+{game.prize} ETB</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>Karta #{game.winningCardId} ({game.pattern})</span>
                  <span>{game.roomName}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

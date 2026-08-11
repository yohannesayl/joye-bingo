import React, { useState, useEffect } from 'react';
import { ShieldAlert, Play, Pause, FastForward, RotateCcw, Users, DollarSign, Settings, Plus, Minus, Search, Check, Lock, Unlock, RefreshCw, Globe } from 'lucide-react';
import { sound } from '../services/soundService';
import { getBackendUrl } from '../services/config';

export default function HostDashboard({ rooms, socket, onOpenServerConfig }) {
  const [activeTab, setActiveTab] = useState('price_management'); // 'price_management', 'user_management', 'caller_controls'
  const [selectedRoomId, setSelectedRoomId] = useState(rooms[0]?.id || 'room_10');

  // Price Management State
  const [roomPrices, setRoomPrices] = useState({
    room_10: { stake: 10, commission: 15 },
    room_20: { stake: 20, commission: 15 },
    room_30: { stake: 30, commission: 15 },
    room_50: { stake: 50, commission: 15 },
    room_80: { stake: 80, commission: 15 },
    room_100: { stake: 100, commission: 10 },
    room_150: { stake: 150, commission: 10 },
    room_200: { stake: 200, commission: 10 },
    room_300: { stake: 300, commission: 10 },
  });
  const [savedPriceNotice, setSavedPriceNotice] = useState('');

  // User Management Database State
  const [userList, setUserList] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Fetch Live Users from Database
  const fetchUsersFromDB = async () => {
    setIsLoadingUsers(true);
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/users`);
      const data = await res.json();
      if (data.users) {
        setUserList(data.users);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsersFromDB();
  }, []);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId) || rooms[0];

  const handlePriceChange = (roomId, field, val) => {
    const num = parseFloat(val) || 0;
    setRoomPrices(prev => ({
      ...prev,
      [roomId]: {
        ...prev[roomId],
        [field]: num
      }
    }));
  };

  const handleSavePrices = () => {
    sound.playClick();
    if (socket) {
      socket.emit('host_update_prices', { roomPrices });
    }
    setSavedPriceNotice('✓ Stake prices & commissions updated live!');
    setTimeout(() => setSavedPriceNotice(''), 4000);
  };

  const handleAdjustBalance = async (userId, delta) => {
    sound.playClick();
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/user-balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, delta })
      });
      const data = await res.json();
      if (data.success) {
        setUserList(prev =>
          prev.map(u => u.id === userId ? { ...u, balance: data.balance } : u)
        );
      }
    } catch (err) {
      console.error('Error updating balance:', err);
    }
  };

  const handleToggleUserStatus = async (userId) => {
    sound.playClick();
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/admin/toggle-block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUserList(prev =>
          prev.map(u => u.id === userId ? { ...u, status: data.user.status } : u)
        );
      }
    } catch (err) {
      console.error('Error toggling block status:', err);
    }
  };

  const filteredUsers = userList.filter(u =>
    (u.username && u.username.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.displayName && u.displayName.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.id && u.id.toLowerCase().includes(userSearch.toLowerCase())) ||
    (u.phone && u.phone.includes(userSearch))
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6">
      
      {/* Top Admin Navigation Header */}
      <div className="bg-[#241338]/90 border border-purple-800/80 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-yellow-400 text-slate-950 flex items-center justify-center font-black text-2xl shadow">
            👑
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Joye Bingo Host Admin Control Center</h2>
            <p className="text-xs text-slate-300">User Management • Persistent Database • Price & Commission Control</p>
          </div>
        </div>

        {/* Tab Switcher & Render Backend Config Button */}
        <div className="flex flex-wrap items-center gap-2 bg-[#120524] p-1.5 rounded-2xl border border-purple-800">
          <button
            onClick={() => { sound.playClick(); setActiveTab('price_management'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'price_management'
                ? 'bg-yellow-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            Price Management
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('user_management'); fetchUsersFromDB(); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'user_management'
                ? 'bg-yellow-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            User Management ({userList.length})
          </button>

          <button
            onClick={() => { sound.playClick(); setActiveTab('caller_controls'); }}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
              activeTab === 'caller_controls'
                ? 'bg-yellow-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            Caller Controls
          </button>

          <button
            onClick={() => { sound.playClick(); onOpenServerConfig && onOpenServerConfig(); }}
            className="px-3 py-2 rounded-xl text-xs font-black bg-purple-950 border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950 transition-all flex items-center gap-1 shadow"
            title="Configure Render Backend URL"
          >
            <Globe className="w-4 h-4" />
            Render API URL
          </button>
        </div>
      </div>

      {/* 1. PRICE MANAGEMENT TAB */}
      {activeTab === 'price_management' && (
        <div className="bg-[#241338]/95 border-2 border-purple-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-popIn">
          <div className="flex items-center justify-between border-b border-purple-800 pb-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-yellow-400" />
                Live Stake & House Commission Price Management
              </h3>
              <p className="text-xs text-slate-300">Set room stakes, house percentage cut, and recalculate prize pots live</p>
            </div>

            <button
              onClick={handleSavePrices}
              className="px-6 py-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow active:scale-95 transition-all flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save Live Prices
            </button>
          </div>

          {savedPriceNotice && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-extrabold text-xs text-center animate-bounce">
              {savedPriceNotice}
            </div>
          )}

          {/* Table Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-[#120524] text-yellow-400 uppercase font-black tracking-wider border-b border-purple-800">
                <tr>
                  <th className="p-3">Stake Room</th>
                  <th className="p-3">Stake Amount (ETB)</th>
                  <th className="p-3">House Cut (%)</th>
                  <th className="p-3">2-Player Pot</th>
                  <th className="p-3">5-Player Pot</th>
                  <th className="p-3">10-Player Pot</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/60 font-bold">
                {Object.keys(roomPrices).map(roomId => {
                  const stake = roomPrices[roomId].stake;
                  const comm = roomPrices[roomId].commission;
                  const calcPot = (count) => Math.round((count * stake) * (1 - comm / 100));

                  return (
                    <tr key={roomId} className="hover:bg-purple-950/40">
                      <td className="p-3 font-extrabold text-white">{roomId.replace('room_', '')} Birr Room</td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={stake}
                          onChange={(e) => handlePriceChange(roomId, 'stake', e.target.value)}
                          className="w-24 bg-slate-950 border border-purple-700 text-yellow-400 font-mono font-black rounded-lg px-2.5 py-1 text-xs"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="number"
                          value={comm}
                          onChange={(e) => handlePriceChange(roomId, 'commission', e.target.value)}
                          className="w-20 bg-slate-950 border border-purple-700 text-yellow-400 font-mono font-black rounded-lg px-2.5 py-1 text-xs"
                        />
                      </td>
                      <td className="p-3 text-emerald-400 font-mono">+{calcPot(2)} ETB</td>
                      <td className="p-3 text-emerald-400 font-mono">+{calcPot(5)} ETB</td>
                      <td className="p-3 text-yellow-400 font-mono font-black">+{calcPot(10)} ETB</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. USER MANAGEMENT TAB (FETCHED FROM DATABASE!) */}
      {activeTab === 'user_management' && (
        <div className="bg-[#241338]/95 border-2 border-purple-800 rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-popIn">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-purple-800 pb-3">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-yellow-400" />
                Persistent Database User Directory ({userList.length} Registered Players)
              </h3>
              <p className="text-xs text-slate-300">View real database user accounts, deposit/deduct Telebirr funds, or suspend accounts</p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={fetchUsersFromDB}
                className="p-2 rounded-xl bg-purple-950 border border-purple-700 text-yellow-400 font-black hover:bg-purple-900 shadow"
                title="Refresh user list from database"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingUsers ? 'animate-spin' : ''}`} />
              </button>

              {/* Search Box */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search username/phone..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-[#120524] text-yellow-400 uppercase font-black tracking-wider border-b border-purple-800">
                <tr>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Display Name / Username</th>
                  <th className="p-3">Telebirr Phone</th>
                  <th className="p-3">Wallet Balance</th>
                  <th className="p-3">Matches / Wins</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple-900/60 font-bold">
                {filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-purple-950/40">
                    <td className="p-3 font-mono text-slate-400">{u.id}</td>
                    <td className="p-3 font-extrabold text-white">
                      {u.displayName || u.username}
                      <span className="block text-[10px] text-slate-400 font-mono">@{u.username}</span>
                    </td>
                    <td className="p-3 font-mono text-slate-300">{u.phone || '0911000000'}</td>
                    <td className="p-3 font-mono text-yellow-400 font-black">{u.balance} ETB</td>
                    <td className="p-3 text-slate-300">{u.gamesPlayed || 0} played / {u.totalWins || 0} won</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        u.status !== 'BLOCKED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500'
                          : 'bg-rose-500/20 text-rose-400 border border-rose-500'
                      }`}>
                        {u.status || 'ACTIVE'}
                      </span>
                    </td>
                    <td className="p-3 text-right space-x-2">
                      <button
                        onClick={() => handleAdjustBalance(u.id, 100)}
                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] shadow"
                      >
                        +100 ETB
                      </button>
                      <button
                        onClick={() => handleAdjustBalance(u.id, -100)}
                        className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white font-black text-[10px] shadow"
                      >
                        -100 ETB
                      </button>
                      <button
                        onClick={() => handleToggleUserStatus(u.id)}
                        className={`px-2.5 py-1 rounded font-black text-[10px] shadow ${
                          u.status !== 'BLOCKED'
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        {u.status !== 'BLOCKED' ? 'Block' : 'Unblock'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. CALLER CONTROLS TAB */}
      {activeTab === 'caller_controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-popIn">
          
          <div className="lg:col-span-2 bg-[#241338]/95 border-2 border-purple-800 rounded-3xl p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-purple-800 pb-3">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-yellow-400" />
                Live Ball Caller Controls
              </h3>

              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="bg-slate-950 border border-purple-700 text-yellow-400 font-black text-xs rounded-xl px-3 py-1.5"
              >
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.stake} ETB)
                  </option>
                ))}
              </select>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  sound.playClick();
                  socket && socket.emit('host_draw_ball', { roomId: selectedRoomId });
                }}
                className="py-4 px-6 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <FastForward className="w-5 h-5" />
                Draw Next Ball Manually
              </button>

              <button
                onClick={() => {
                  sound.playClick();
                  socket && socket.emit('host_reset_room', { roomId: selectedRoomId });
                }}
                className="py-4 px-6 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"
              >
                <RotateCcw className="w-5 h-5" />
                Reset Match & Clear Cards
              </button>
            </div>

          </div>

          <div className="bg-[#241338]/95 border-2 border-purple-800 rounded-3xl p-6 space-y-4 shadow-2xl text-xs">
            <h3 className="font-extrabold text-white border-b border-purple-800 pb-3">
              Room Live Audit Status
            </h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#120524] border border-purple-800">
                <span className="text-slate-400">Selected Room:</span>
                <span className="font-extrabold text-yellow-400">{selectedRoom?.name}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#120524] border border-purple-800">
                <span className="text-slate-400">Match Status:</span>
                <span className="font-extrabold text-emerald-400 uppercase">{selectedRoom?.status}</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#120524] border border-purple-800">
                <span className="text-slate-400">Joined Players:</span>
                <span className="font-extrabold text-white">{selectedRoom?.playerCount || 0} Players</span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-[#120524] border border-purple-800">
                <span className="text-slate-400">Live Prize Pot:</span>
                <span className="font-extrabold text-yellow-400 font-mono">{selectedRoom?.pot || 17} ETB</span>
              </div>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}

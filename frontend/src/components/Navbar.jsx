import React from 'react';
import { Wallet, Globe, RotateCcw, Home, Trophy, HelpCircle, User, ShieldAlert, LogIn } from 'lucide-react';
import { sound } from '../services/soundService';

export default function Navbar({
  user,
  activeTab,
  setActiveTab,
  onOpenWallet,
  onOpenRules,
  onOpenContact,
  onOpenAuth,
  onRefresh,
  onGoHome
}) {
  return (
    <header className="bg-[#2a1240]/95 backdrop-blur border-b border-purple-900/60 px-4 py-3 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        
        {/* Brand Logo */}
        <div 
          onClick={() => { sound.playClick(); onGoHome(); }}
          className="flex items-center gap-2 cursor-pointer group"
        >
          <div className="w-10 h-10 rounded-full border-2 border-yellow-400 bg-purple-950 flex items-center justify-center text-yellow-400 font-extrabold text-xl shadow-md group-hover:scale-105 transition-transform">
            🎯
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-white flex items-center gap-1">
              <span className="text-yellow-400 font-black">Joye</span> BINGO
            </span>
          </div>
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-5 text-xs font-extrabold text-slate-200">
          <button 
            onClick={() => { sound.playClick(); onGoHome(); }}
            className={`hover:text-yellow-400 transition-colors ${activeTab === 'lobby' ? 'text-yellow-400 underline underline-offset-4' : ''}`}
          >
            Home
          </button>
          
          <button 
            onClick={() => { sound.playClick(); setActiveTab('host'); }}
            className={`px-3 py-1.5 rounded-xl border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-slate-950 transition-all font-black flex items-center gap-1.5 shadow ${
              activeTab === 'host' ? 'bg-yellow-400 text-slate-950' : 'bg-purple-950/80'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            👑 Host Admin / Management
          </button>

          <button 
            onClick={() => { sound.playClick(); setActiveTab('leaderboard'); }}
            className={`hover:text-yellow-400 transition-colors ${activeTab === 'leaderboard' ? 'text-yellow-400 underline underline-offset-4' : ''}`}
          >
            Leaderboard
          </button>

          <button 
            onClick={() => { sound.playClick(); onOpenRules(); }}
            className="hover:text-yellow-400 transition-colors"
          >
            How To Play
          </button>

          <button 
            onClick={() => { sound.playClick(); onOpenContact(); }}
            className="hover:text-yellow-400 transition-colors"
          >
            Contact
          </button>
        </nav>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* USER ACCOUNT SIGN IN / PROFILE BUTTON */}
          <button
            onClick={() => { sound.playClick(); onOpenAuth(); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-950/80 border border-purple-700 text-slate-200 font-extrabold text-xs hover:border-yellow-400 hover:text-yellow-400 transition-all"
          >
            <User className="w-3.5 h-3.5 text-yellow-400" />
            <span className="max-w-[90px] truncate">{user?.displayName || user?.username || 'Sign In'}</span>
          </button>

          {/* Wallet Balance Pill */}
          <button
            onClick={() => { sound.playClick(); onOpenWallet(); }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400 text-slate-950 font-black text-xs shadow hover:bg-yellow-300 transition-all"
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>ETB {user?.balance || 100}</span>
          </button>
        </div>

      </div>

      {/* Mobile Bar Links */}
      <div className="flex md:hidden items-center justify-around border-t border-purple-900/60 mt-2 pt-2 text-xs font-extrabold text-slate-300">
        <button 
          onClick={() => { sound.playClick(); onGoHome(); }}
          className={`flex items-center gap-1 ${activeTab === 'lobby' ? 'text-yellow-400' : ''}`}
        >
          <Home className="w-3.5 h-3.5" /> Home
        </button>

        <button 
          onClick={() => { sound.playClick(); setActiveTab('host'); }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded bg-purple-950 border border-yellow-400 ${activeTab === 'host' ? 'bg-yellow-400 text-slate-950 font-black' : 'text-yellow-400'}`}
        >
          <ShieldAlert className="w-3.5 h-3.5" /> Admin
        </button>

        <button 
          onClick={() => { sound.playClick(); onOpenAuth(); }}
          className="flex items-center gap-1 text-yellow-400 font-bold"
        >
          <User className="w-3.5 h-3.5 text-yellow-400" /> Account
        </button>

        <button 
          onClick={() => { sound.playClick(); onOpenRules(); }}
          className="flex items-center gap-1"
        >
          <HelpCircle className="w-3.5 h-3.5 text-yellow-400" /> Rules
        </button>
      </div>
    </header>
  );
}

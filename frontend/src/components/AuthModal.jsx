import React, { useState } from 'react';
import { X, LogIn, UserPlus, Phone, Lock, User, Sparkles, AlertCircle, Globe, Check } from 'lucide-react';
import { sound } from '../services/soundService';
import { getBackendUrl, setBackendUrl } from '../services/config';

export default function AuthModal({ onLoginSuccess, onClose }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  
  // Login State
  const [loginInput, setLoginInput] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register State
  const [fullName, setFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');

  // Render Server URL Config State
  const [renderUrlInput, setRenderUrlInput] = useState(getBackendUrl());
  const [showServerInput, setShowServerInput] = useState(false);

  // Error & Loading
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSaveRenderUrl = () => {
    sound.playClick();
    if (renderUrlInput) {
      setBackendUrl(renderUrlInput);
      setErrorMsg('');
      setShowServerInput(false);
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!loginInput || !loginPassword) {
      setErrorMsg('Please enter your username/phone and password.');
      return;
    }

    setIsLoading(true);
    sound.playClick();

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginInput, password: loginPassword })
      });
      
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Login failed! Please check your credentials.');
        return;
      }

      sound.playWinFanfare();
      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setIsLoading(false);
      setShowServerInput(true);
      setErrorMsg('Cannot connect to Render backend server. Please paste your live Render URL below to connect.');
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    if (!regUsername || !regPhone || !regPassword) {
      setErrorMsg('Username, Telebirr Phone Number, and Password are required.');
      return;
    }

    setIsLoading(true);
    sound.playClick();

    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName,
          username: regUsername,
          phone: regPhone,
          password: regPassword
        })
      });
      
      const data = await res.json();
      setIsLoading(false);

      if (!res.ok || data.error) {
        setErrorMsg(data.error || 'Registration failed.');
        return;
      }

      sound.playWinFanfare();
      onLoginSuccess(data.user);
      onClose();
    } catch (err) {
      setIsLoading(false);
      setShowServerInput(true);
      setErrorMsg('Cannot connect to Render backend server. Please paste your live Render URL below to connect.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1e0a2f]/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#241338] border-2 border-yellow-400 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-popIn">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-lg">
              🎯
            </div>
            <h3 className="font-extrabold text-xl text-white">
              {mode === 'login' ? 'Sign In to Joye Bingo' : 'Create New Account'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-2 bg-[#120524] p-1.5 rounded-2xl border border-purple-800">
          <button
            onClick={() => { sound.playClick(); setMode('login'); setErrorMsg(''); }}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              mode === 'login'
                ? 'bg-yellow-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Sign In
          </button>

          <button
            onClick={() => { sound.playClick(); setMode('register'); setErrorMsg(''); }}
            className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              mode === 'register'
                ? 'bg-yellow-400 text-slate-950 shadow'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Register
          </button>
        </div>

        {/* Welcome Bonus Banner for Register */}
        {mode === 'register' && (
          <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500 text-emerald-300 font-extrabold text-xs text-center flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span>🎉 FREE +100 ETB WELCOME BONUS ON SIGN UP!</span>
          </div>
        )}

        {/* Error Message */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500 text-rose-300 font-bold text-xs space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>

            {/* INTERACTIVE SERVER URL INPUT BOX WHEN CONNECTION FAILS */}
            {showServerInput && (
              <div className="pt-2 space-y-2 border-t border-rose-500/40">
                <label className="text-[11px] font-extrabold text-white flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-yellow-400" />
                  Paste Render Backend URL:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="https://joye-bingo.onrender.com"
                    value={renderUrlInput}
                    onChange={(e) => setRenderUrlInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-purple-600 text-yellow-400 font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-yellow-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveRenderUrl}
                    className="px-3 py-1.5 rounded-lg bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs shadow flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Username or Telebirr Phone:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="e.g. Abebe_Bingo or 0911223344"
                  value={loginInput}
                  onChange={(e) => setLoginInput(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Password:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              {isLoading ? 'Signing In...' : 'Sign In Now'}
            </button>
          </form>
        ) : (
          /* REGISTER FORM */
          <form onSubmit={handleRegisterSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Full Name (Optional):
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Abebe Bikila"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Username:
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. Abebe_Bingo"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Telebirr Phone Number:
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="e.g. 0911223344"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-extrabold text-slate-300 uppercase tracking-wider">
                Password:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#120524] border border-purple-700 text-white font-bold text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg active:scale-95 transition-all"
            >
              {isLoading ? 'Creating Account...' : 'Register & Claim 100 ETB Bonus'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}

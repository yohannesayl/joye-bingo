import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Lobby from './components/Lobby';
import BingoGame from './components/BingoGame';
import CardSelector from './components/CardSelector';
import HostDashboard from './components/HostDashboard';
import WalletModal from './components/WalletModal';
import Leaderboard from './components/Leaderboard';
import AuthModal from './components/AuthModal';
import { getTelegramData } from './services/telegramService';
import { socketService } from './services/socketService';
import { sound } from './services/soundService';
import { X, HelpCircle, PhoneCall, Send, AlertTriangle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [isTelegram, setIsTelegram] = useState(false);
  const [activeTab, setActiveTab] = useState('lobby');
  const [rooms, setRooms] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState('room_10');
  const [showCardSelector, setShowCardSelector] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [playingNoticeModal, setPlayingNoticeModal] = useState(false);
  const [lang, setLang] = useState('am');

  // Initialize & Restore Exact User Balance From Database
  useEffect(() => {
    const tgInfo = getTelegramData();
    setIsTelegram(tgInfo.isTelegram);

    const savedUserStr = localStorage.getItem('karta_user');
    let initialUser = tgInfo.user || (savedUserStr ? JSON.parse(savedUserStr) : null);

    if (!initialUser) {
      initialUser = {
        id: `user_${Math.floor(1000 + Math.random() * 9000)}`,
        username: `Player_${Math.floor(100 + Math.random() * 900)}`,
        displayName: `Player #${Math.floor(100 + Math.random() * 900)}`
      };
      loginUser(initialUser);
    } else {
      // FETCH EXACT REAL BALANCE FROM BACKEND DATABASE!
      fetch(`/api/wallet/${initialUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.balance !== undefined) {
            const updatedUser = { ...initialUser, balance: data.balance };
            setUser(updatedUser);
            localStorage.setItem('karta_user', JSON.stringify(updatedUser));
          } else {
            setUser(initialUser);
          }
        })
        .catch(() => {
          setUser(initialUser);
        });
    }
  }, []);

  const loginUser = async (userInfo) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userInfo)
      });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
        localStorage.setItem('karta_user', JSON.stringify(data.user));
      }
    } catch (e) {
      console.error('Login error:', e);
      setUser(userInfo);
    }
  };

  const handleLoginSuccess = (authenticatedUser) => {
    setUser(authenticatedUser);
    localStorage.setItem('karta_user', JSON.stringify(authenticatedUser));
  };

  const refreshUser = async () => {
    if (user?.id) {
      try {
        const res = await fetch(`/api/wallet/${user.id}`);
        const data = await res.json();
        if (data && data.balance !== undefined) {
          const updated = { ...user, balance: data.balance };
          setUser(updated);
          localStorage.setItem('karta_user', JSON.stringify(updated));
        }
      } catch (e) {}
    }
  };

  const handleAddFreeCoins = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch('/api/wallet/free-coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...user, balance: data.balance };
        setUser(updated);
        localStorage.setItem('karta_user', JSON.stringify(updated));
        sound.playWinFanfare();
      }
    } catch (e) {
      console.error('Error adding free coins:', e);
    }
  };

  // Socket setup & Room state handler
  useEffect(() => {
    const socket = socketService.connect();

    socket.on('lobby_list', (roomList) => {
      setRooms(roomList);
    });

    socket.on('room_state', (roomDetails) => {
      if (roomDetails.id === currentRoomId || !currentRoomId) {
        setCurrentRoom(roomDetails);
      }
      setRooms(prev => prev.map(r => r.id === roomDetails.id ? { ...r, ...roomDetails } : r));

      // AUTO REJOIN FEATURE: ONLY IF PLAYER ALREADY HAS A CONFIRMED CARD IN THIS MATCH!
      if (user?.id && roomDetails.purchasedCards) {
        const userHasCard = roomDetails.purchasedCards.some(cp => cp.userId === user.id);
        if (userHasCard && (roomDetails.status === 'COUNTDOWN' || roomDetails.status === 'PLAYING')) {
          setShowCardSelector(false);
          setActiveTab('game');
        }
      }
    });

    socket.on('card_bought', (res) => {
      sound.playWinFanfare();
      if (res.balance !== undefined) {
        setUser(prev => {
          const updated = { ...prev, balance: res.balance };
          localStorage.setItem('karta_user', JSON.stringify(updated));
          return updated;
        });
      }
    });

    return () => {
      socket.off('lobby_list');
      socket.off('room_state');
      socket.off('card_bought');
    };
  }, [currentRoomId, user?.id]);

  const handleGoHome = () => {
    setShowCardSelector(false);
    setShowWallet(false);
    setShowRules(false);
    setShowContact(false);
    setShowAuthModal(false);
    setActiveTab('lobby');
  };

  const handleJoinRoom = (roomId) => {
    setCurrentRoomId(roomId);
    const targetRoom = currentRoom || rooms.find(r => r.id === roomId);

    if (targetRoom && targetRoom.status === 'PLAYING') {
      const userHasCard = (targetRoom.purchasedCards || []).some(cp => cp.userId === user?.id);
      if (!userHasCard) {
        sound.playClick();
        setPlayingNoticeModal(true);
        return;
      }
    }

    socketService.joinRoom(roomId, user);

    if (targetRoom && targetRoom.purchasedCards && user?.id) {
      const userHasCard = targetRoom.purchasedCards.some(cp => cp.userId === user.id);
      if (userHasCard) {
        setShowCardSelector(false);
        setActiveTab('game');
        return;
      }
    }

    setShowCardSelector(true);
  };

  const handleLeaveRoom = () => {
    if (currentRoomId) {
      socketService.leaveRoom(currentRoomId);
    }
    setCurrentRoomId(null);
    setCurrentRoom(null);
    setActiveTab('lobby');
  };

  const handleBuyCard = (cardId) => {
    if (!currentRoomId) return;
    socketService.buyCard(currentRoomId, user.id, cardId);
    setShowCardSelector(false);
    setActiveTab('game');
  };

  const safeRoom = currentRoom || rooms.find(r => r.id === currentRoomId) || {
    id: 'room_10',
    name: '10birr Match',
    stake: 10,
    status: 'WAITING_FOR_PLAYERS',
    countdownSeconds: 45,
    calledBalls: [],
    currentBall: null,
    pot: 17,
    purchasedCards: []
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#200936] text-slate-100 selection:bg-yellow-400 selection:text-slate-950 font-outfit">
      
      {/* Top Navbar */}
      <Navbar
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenWallet={() => setShowWallet(true)}
        onOpenRules={() => setShowRules(true)}
        onOpenContact={() => setShowContact(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onRefresh={refreshUser}
        onGoHome={handleGoHome}
        lang={lang}
        setLang={setLang}
      />

      {/* Main View Area */}
      <main className="flex-1 pb-12">
        {activeTab === 'lobby' && (
          <Lobby
            rooms={rooms}
            onJoinRoom={handleJoinRoom}
          />
        )}

        {activeTab === 'game' && (
          <BingoGame
            room={safeRoom}
            user={user}
            socket={socketService.getSocket()}
            onOpenCardSelector={() => {
              const userHasCard = (safeRoom.purchasedCards || []).some(cp => cp.userId === user?.id);
              if (!userHasCard && safeRoom.status !== 'PLAYING') {
                setShowCardSelector(true);
              }
            }}
            onLeaveRoom={handleLeaveRoom}
          />
        )}

        {activeTab === 'host' && (
          <HostDashboard
            rooms={rooms}
            socket={socketService.getSocket()}
          />
        )}

        {activeTab === 'leaderboard' && (
          <Leaderboard />
        )}
      </main>

      {/* USER AUTH REGISTER / LOGIN MODAL */}
      {showAuthModal && (
        <AuthModal
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowAuthModal(false)}
        />
      )}

      {/* MID-GAME PLAYING NOTICE MODAL */}
      {playingNoticeModal && (
        <div className="fixed inset-0 z-50 bg-[#1e0a2f]/95 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#241338] border-2 border-yellow-400 rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl animate-popIn">
            
            <div className="w-16 h-16 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-extrabold text-white">
              Match Currently In Progress!
            </h3>

            <p className="text-xs text-slate-300">
              This stake match is currently in the <strong>PLAYING</strong> step. New players cannot join mid-game. Please wait a few moments for the match to complete, then join the next round!
            </p>

            <button
              onClick={() => {
                sound.playClick();
                setPlayingNoticeModal(false);
              }}
              className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider shadow"
            >
              Understand & Wait For Next Round
            </button>
          </div>
        </div>
      )}

      {/* STEP 2 CARD GRID SELECTION OVERLAY */}
      {showCardSelector && (
        <CardSelector
          room={safeRoom}
          user={user}
          onBuyCard={handleBuyCard}
          onClose={() => setShowCardSelector(false)}
        />
      )}

      {showWallet && (
        <WalletModal
          user={user}
          onClose={() => setShowWallet(false)}
          onRefreshUser={refreshUser}
        />
      )}

      {showRules && (
        <div className="fixed inset-0 z-50 bg-[#1e0a2f]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#241338] border-2 border-yellow-400 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-popIn">
            <div className="flex items-center justify-between border-b border-purple-800 pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-yellow-400" />
                How To Play Joye Bingo
              </h3>
              <button onClick={() => setShowRules(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-200">
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xs">1</span>
                <p><strong>Join a Stake Room</strong> (`10birr`, `20birr`, `100birr`) from the Stake Table.</p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xs">2</span>
                <p><strong>Pick Your Card Box</strong>: Select your card numbers (1 to 252) during the countdown and click <strong>Confirm Cards</strong>.</p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xs">3</span>
                <p><strong>Listen to Voice Caller</strong>: System calls random numbers every 3s out loud. Compare and tap matching numbers on your card!</p>
              </div>

              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-yellow-400 text-slate-950 font-black flex items-center justify-center text-xs">4</span>
                <p><strong>Hit BINGO!</strong>: When you get 5 in a row (row, col, diag, 4 corners), tap <strong>Bingo</strong> to win the cash pot!</p>
              </div>
            </div>

            <button
              onClick={() => setShowRules(false)}
              className="w-full py-2.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs shadow"
            >
              Got It! Let's Play
            </button>
          </div>
        </div>
      )}

      {showContact && (
        <div className="fixed inset-0 z-50 bg-[#1e0a2f]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#241338] border-2 border-yellow-400 rounded-3xl max-w-md w-full p-6 space-y-4 text-center shadow-2xl animate-popIn">
            <div className="flex items-center justify-between border-b border-purple-800 pb-3">
              <h3 className="font-extrabold text-lg text-white flex items-center gap-2">
                <PhoneCall className="w-5 h-5 text-yellow-400" />
                Contact Joye Bingo Support
              </h3>
              <button onClick={() => setShowContact(false)} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#120524] border border-purple-800 space-y-2">
              <Send className="w-8 h-8 text-yellow-400 mx-auto" />
              <h4 className="font-extrabold text-white text-base">Telegram 24/7 Support</h4>
              <p className="text-xs text-slate-300">
                Contact our support bot or channel for instant deposit help, feedback, or inquiries:
              </p>
              <p className="font-extrabold text-yellow-400 font-mono text-sm pt-1">@joyebingobot</p>
            </div>

            <button
              onClick={() => setShowContact(false)}
              className="w-full py-2.5 rounded-xl bg-yellow-400 text-slate-950 font-black text-xs shadow"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-purple-900/60 bg-[#160528] py-4 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 Joye Bingo. All rights reserved.</p>
          <div className="flex items-center gap-4 text-slate-300">
            <span className="hover:text-yellow-400 cursor-pointer" onClick={handleGoHome}>Home</span>
            <span className="hover:text-yellow-400 cursor-pointer" onClick={() => setActiveTab('leaderboard')}>Leaderboard</span>
            <span className="hover:text-yellow-400 cursor-pointer" onClick={() => setShowRules(true)}>How To Play</span>
            <span className="hover:text-yellow-400 cursor-pointer" onClick={handleAddFreeCoins}>+1,000 Free Coins</span>
          </div>
        </div>
      </footer>

    </div>
  );
}

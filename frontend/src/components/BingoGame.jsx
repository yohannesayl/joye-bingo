import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, ArrowLeft, Users, Trophy, Flame, Sparkles, CheckCircle2, Clock, UserPlus, Bot } from 'lucide-react';
import confetti from 'canvas-confetti';
import { sound } from '../services/soundService';
import { socketService } from '../services/socketService';
import { generateBingoCard } from '../services/gameEngine';

// BINGO RULE PATTERN CHECKER (Row, Column, Diagonal, or 4 Corners)
const checkCardBingoPattern = (matrix, markedSet) => {
  if (!matrix || !markedSet) return false;

  // 1. Check Rows
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    for (let c = 0; c < 5; c++) {
      const cell = matrix[r][c];
      if (!cell.isFree && !markedSet.has(cell.number)) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) return { type: `Horizontal Row ${r + 1}` };
  }

  // 2. Check Columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    for (let r = 0; r < 5; r++) {
      const cell = matrix[r][c];
      if (!cell.isFree && !markedSet.has(cell.number)) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) return { type: `Vertical Column ${c + 1}` };
  }

  // 3. Check Main Diagonal
  let diag1 = true;
  for (let i = 0; i < 5; i++) {
    const cell = matrix[i][i];
    if (!cell.isFree && !markedSet.has(cell.number)) {
      diag1 = false;
      break;
    }
  }
  if (diag1) return { type: 'Diagonal Line' };

  // 4. Check Anti Diagonal
  let diag2 = true;
  for (let i = 0; i < 5; i++) {
    const cell = matrix[i][4 - i];
    if (!cell.isFree && !markedSet.has(cell.number)) {
      diag2 = false;
      break;
    }
  }
  if (diag2) return { type: 'Diagonal Line' };

  // 5. Check 4 Corners
  const corners = [matrix[0][0], matrix[0][4], matrix[4][0], matrix[4][4]];
  const cornersComplete = corners.every(cell => cell.isFree || markedSet.has(cell.number));
  if (cornersComplete) return { type: '4 Corners Pattern' };

  return false;
};

export default function BingoGame({ room, user, socket, onOpenCardSelector, onLeaveRoom }) {
  const [myCards, setMyCards] = useState([]);
  const [autoCardSelector, setAutoCardSelector] = useState(false);
  const [daubedMap, setDaubedMap] = useState({});
  const [winnerModal, setWinnerModal] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [voiceLang, setVoiceLang] = useState('en');
  const [callSpeedMs, setCallSpeedMs] = useState(3000);
  const [audioStarted, setAudioStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(room?.status === 'FINISHED');

  // COUNTDOWN TIMER & PLAYING STATUS STATE
  const [step3Countdown, setStep3Countdown] = useState(room?.countdownSeconds !== undefined ? room.countdownSeconds : 30);
  const [isStep4Active, setIsStep4Active] = useState(room?.status === 'PLAYING' || (room?.calledBalls && room.calledBalls.length > 0));
  const [liveCalledBalls, setLiveCalledBalls] = useState(room?.calledBalls || []);
  const [liveCurrentBall, setLiveCurrentBall] = useState(room?.currentBall || null);

  const isWaitingForPlayers = false;

  // Sync room props updates
  useEffect(() => {
    if (!room) return;
    if (room.status === 'PLAYING' || room.status === 'COUNTDOWN' || (room.calledBalls && room.calledBalls.length > 0)) {
      setIsGameOver(false);
    }
    if (room.status === 'PLAYING' || (room.calledBalls && room.calledBalls.length > 0)) {
      setIsStep4Active(true);
    }
    if (room.status === 'FINISHED') {
      setIsGameOver(true);
    }
    if (room.calledBalls) setLiveCalledBalls(room.calledBalls);
    if (room.currentBall) setLiveCurrentBall(room.currentBall);
    if (room.winner) setWinnerModal(room.winner);
  }, [room?.status, room?.calledBalls, room?.currentBall, room?.winner]);

  // SOCKET REAL-TIME SYNC: ALL BROWSERS RECEIVE SAME DRAWN BALLS & WINNER BROADCAST!
  useEffect(() => {
    if (!socket) return;

    const handleBallCalled = (data) => {
      if (isGameOver) return;
      if (data.ball) {
        setIsStep4Active(true);
        setLiveCurrentBall(data.ball);
        setLiveCalledBalls(data.calledBalls || []);
        sound.initContext();
        sound.playBallPop();
        if (voiceOn) {
          sound.speakBall(data.ball.letter, data.ball.number);
        }
      }
    };

    const handleBingoWinner = (data) => {
      setIsGameOver(true);
      setIsStep4Active(false);

      const winnerData = data.winner;
      setWinnerModal(winnerData);

      if (winnerData.userId === user?.id) {
        sound.playWinFanfare();
        confetti({ particleCount: 240, spread: 140, origin: { y: 0.4 } });
      } else {
        sound.playClick();
      }
    };

    const handleRoomState = (data) => {
      if (!data) return;
      if (data.status === 'PLAYING' || (data.calledBalls && data.calledBalls.length > 0)) {
        setIsStep4Active(true);
        setIsGameOver(false);
      }
      if (data.currentBall) setLiveCurrentBall(data.currentBall);
      if (data.calledBalls) setLiveCalledBalls(data.calledBalls);
      if (data.countdownSeconds !== undefined) setStep3Countdown(data.countdownSeconds);
    };

    socket.on('ball_called', handleBallCalled);
    socket.on('bingo_winner', handleBingoWinner);
    socket.on('room_state', handleRoomState);

    return () => {
      socket.off('ball_called', handleBallCalled);
      socket.off('bingo_winner', handleBingoWinner);
      socket.off('room_state', handleRoomState);
    };
  }, [socket, voiceOn, isGameOver, user?.id]);

  // Smooth 1-second countdown ticker (synced with server updates)
  useEffect(() => {
    if (isStep4Active || isGameOver) return;

    const timer = setInterval(() => {
      setStep3Countdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsStep4Active(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStep4Active, isGameOver]);

  // Default fallback card (Card No. 72)
  const defaultCard72 = {
    id: 72,
    name: 'Card No. 72',
    matrix: [
      [{ number: 2 }, { number: 28 }, { number: 40 }, { number: 57 }, { number: 63 }],
      [{ number: 7 }, { number: 27 }, { number: 39 }, { number: 55 }, { number: 67 }],
      [{ number: 6 }, { number: 29 }, { number: 'FREE', isFree: true }, { number: 58 }, { number: 72 }],
      [{ number: 4 }, { number: 30 }, { number: 45 }, { number: 51 }, { number: 65 }],
      [{ number: 11 }, { number: 18 }, { number: 43 }, { number: 46 }, { number: 66 }]
    ]
  };

  // Sync my purchased cards with safe resolution
  useEffect(() => {
    if (!room || !user) return;
    const purchases = (room.purchasedCards || []).filter(cp =>
      cp.userId === user.id || (cp.userName && cp.userName.toLowerCase() === (user.displayName || user.username || '').toLowerCase())
    );

    const resolvedCards = purchases.map(cp => {
      if (cp.card && Array.isArray(cp.card.matrix)) return cp.card;
      if (cp.cardId) return generateBingoCard(cp.cardId);
      return null;
    }).filter(Boolean);

    const savedCardIdStr = room?.id ? sessionStorage.getItem(`joye_card_${room.id}`) : null;
    const savedCardId = savedCardIdStr ? parseInt(savedCardIdStr, 10) : null;
    const fallbackCard = (savedCardId && !isNaN(savedCardId)) ? generateBingoCard(savedCardId) : defaultCard72;

    const activeCardsList = resolvedCards.length > 0 ? resolvedCards : [fallbackCard];
    setMyCards(activeCardsList);

    setDaubedMap(prev => {
      const next = { ...prev };
      activeCardsList.forEach(card => {
        if (card && card.id && !next[card.id]) {
          next[card.id] = new Set(['FREE']);
        }
      });
      return next;
    });
  }, [room?.purchasedCards, user?.id]);

  // AUTO CARD SELECTOR (AUTO DAUBER)
  useEffect(() => {
    if (!autoCardSelector || !isStep4Active || isGameOver) return;

    (myCards || []).forEach(card => {
      if (!card || !Array.isArray(card.matrix)) return;
      const cardCalledNumbers = [];
      (card.matrix || []).forEach(row => {
        (row || []).forEach(cell => {
          if (cell && !cell.isFree && Array.isArray(liveCalledBalls) && liveCalledBalls.includes(cell.number)) {
            cardCalledNumbers.push(cell.number);
          }
        });
      });

      if (cardCalledNumbers.length > 0) {
        setDaubedMap(prev => {
          const currentSet = new Set(prev[card.id] || ['FREE']);
          let updated = false;

          cardCalledNumbers.forEach(num => {
            if (!currentSet.has(num)) {
              currentSet.add(num);
              updated = true;
            }
          });

          if (updated) {
            sound.initContext();
            sound.playDaubSound();
            return { ...prev, [card.id]: currentSet };
          }
          return prev;
        });
      }
    });
  }, [autoCardSelector, liveCalledBalls, isStep4Active, isGameOver, myCards]);

  // CELL DAUBING: ONLY CLICKABLE IF SYSTEM HAS CALLED THE NUMBER!
  const handleToggleDaub = (cardId, number) => {
    if (number === 'FREE' || !isStep4Active || isGameOver) return;

    const isNumberCalled = liveCalledBalls.includes(number);
    if (!isNumberCalled) return;

    sound.initContext();
    sound.playDaubSound();
    setDaubedMap(prev => {
      const currentSet = new Set(prev[cardId] || ['FREE']);
      if (currentSet.has(number)) currentSet.delete(number);
      else currentSet.add(number);
      return { ...prev, [cardId]: currentSet };
    });
  };

  const handleAddBot = () => {
    sound.playClick();
    socketService.addBotPlayer(room?.id || 'room_10');
  };

  const safeActiveCard = (myCards[0] && Array.isArray(myCards[0].matrix)) ? myCards[0] : defaultCard72;
  const currentMarkedSet = daubedMap[safeActiveCard.id] || new Set(['FREE']);

  // CHECK IF BINGO PATTERN IS MATCHED
  const matchedBingoPattern = checkCardBingoPattern(safeActiveCard.matrix, currentMarkedSet);
  const isBingoRuleMatched = Boolean(matchedBingoPattern);

  // CLICKING BINGO
  const handleClaimBingo = (cardId) => {
    if (!isBingoRuleMatched || isGameOver || !isStep4Active) {
      sound.playClick();
      return;
    }

    sound.playClick();
    sound.playWinFanfare();
    confetti({ particleCount: 240, spread: 140, origin: { y: 0.4 } });
    setIsGameOver(true);

    const winAmount = room?.pot || 17;

    const winDetails = {
      userId: user?.id,
      userName: user?.displayName || user?.username || 'Player #104',
      cardId: cardId || 72,
      pattern: matchedBingoPattern?.type || '5 in a Row',
      prize: winAmount
    };

    setWinnerModal(winDetails);

    if (socket) {
      socket.emit('claim_bingo', { roomId: room?.id || 'room_10', userId: user?.id, cardId });
    }
  };

  const handleEnableAudio = () => {
    sound.initContext();
    setAudioStarted(true);
    if (liveCurrentBall) {
      sound.speakBall(liveCurrentBall.letter, liveCurrentBall.number);
    }
  };

  const calledSet = new Set(liveCalledBalls);
  const recentBalls = Array.from(calledSet).slice(-4).reverse();
  const isUserWinner = winnerModal && winnerModal.userId === user?.id;

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-3 space-y-3" onClick={() => sound.initContext()}>
      
      {/* Top Header Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[#241338]/90 px-4 py-2 rounded-2xl border border-purple-800">
        <button
          onClick={() => { sound.playClick(); onLeaveRoom(); }}
          className="px-3 py-1 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1 shadow"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Leave Match
        </button>

        <span className="text-xs font-black text-yellow-400 font-mono">
          {isGameOver
            ? '🏆 Match Finished!'
            : isWaitingForPlayers
            ? '👥 Waiting for Players (Need 2+)'
            : isStep4Active
            ? '⚡ PLAYING'
            : `⏱ Selection Countdown: 0:${step3Countdown < 10 ? '0' : ''}${step3Countdown}`}
        </span>

        {/* Speed Controls */}
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="text-slate-300 text-[11px]">Speed:</span>
          {[
            { label: '⚡ 2s', ms: 2000 },
            { label: '🎯 3s', ms: 3000 },
            { label: '🐢 4s', ms: 4000 },
          ].map(({ label, ms }) => (
            <button
              key={ms}
              onClick={() => { sound.playClick(); setCallSpeedMs(ms); }}
              className={`px-2 py-0.5 rounded text-[11px] font-extrabold border ${
                callSpeedMs === ms
                  ? 'bg-yellow-400 text-slate-950 border-white shadow'
                  : 'bg-purple-950 text-slate-300 border-purple-800 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Voice Language Switcher */}
        <button
          onClick={() => {
            const next = voiceLang === 'am' ? 'en' : 'am';
            setVoiceLang(next);
            sound.setLanguage(next);
            if (liveCurrentBall) sound.speakBall(liveCurrentBall.letter, liveCurrentBall.number);
          }}
          className="px-2.5 py-1 rounded-lg bg-purple-950 border border-purple-700 text-yellow-400 font-black text-xs shadow hover:bg-purple-900"
        >
          🔊 {voiceLang === 'am' ? '🇪🇹 Amharic' : '🇬🇧 English'}
        </button>
      </div>

      {/* STEP 3 COUNTDOWN BANNER (0:30 -> 0:00) */}
      {!isStep4Active && !isGameOver && (
        <div className="bg-[#241338]/90 border-2 border-yellow-400 p-4 rounded-3xl text-center space-y-2 shadow-2xl animate-popIn">
          <div className="flex items-center justify-center gap-2 text-emerald-400 font-extrabold text-xs sm:text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>STEP 2 COMPLETE: CARD CONFIRMED & REGISTERED FOR MATCH!</span>
          </div>

          <h3 className="text-base sm:text-lg font-extrabold text-white">
            Step 3: Waiting for selection timer to reach 0:00...
          </h3>

          <div className="digital-clock-green text-4xl font-mono py-1">
            0:{step3Countdown < 10 ? '0' : ''}{step3Countdown}
          </div>

          <p className="text-[11px] text-slate-300 max-w-md mx-auto">
            When timer reaches 0:00, Step 4 System Ball Calling will automatically start! Listen to the voice caller and mark matching numbers on your card below.
          </p>
        </div>
      )}

      {/* Audio Warmup Banner */}
      {!audioStarted && (
        <button
          onClick={handleEnableAudio}
          className="w-full py-2 bg-yellow-400 text-slate-950 font-black text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg animate-bounce hover:bg-yellow-300"
        >
          <Volume2 className="w-4 h-4 text-slate-950 animate-pulse" />
          <span>🔊 CLICK ONCE TO ACTIVATE LIVE VOICE CALLER (SPEAKER AUDIO)!</span>
        </button>
      )}

      {/* MATCH SCREEN: LEFT CALLER BOX + RIGHT 1-75 BOARD + CARD NO. 72 */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
        
        {/* Left Column: 3D System Ball Caller Box */}
        <div className="md:col-span-4 bg-[#241338]/90 border border-purple-800/60 p-4 rounded-2xl flex flex-col items-center justify-between text-center shadow-xl space-y-3">
          
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest flex items-center justify-center gap-1">
            {isGameOver ? '🏆 MATCH FINISHED' : isWaitingForPlayers ? '👥 WAITING FOR PLAYERS' : isStep4Active ? 'STEP 4: SYSTEM BALL CALLER BOX' : 'STEP 3: WAITING FOR 0:00'}
          </span>

          {/* 3D Animated Ball & History Bubbles */}
          <div className="flex items-center justify-center gap-3 my-1">
            {isStep4Active ? (
              <div key={liveCurrentBall?.number || 'b12'} className="w-28 h-28 rounded-full bg-[#103860] border-4 border-[#869ab0] flex flex-col items-center justify-center text-white shadow-2xl animate-popIn">
                <span className="text-lg font-black font-mono">
                  {liveCurrentBall?.letter || 'B'}
                </span>
                <span className="text-5xl font-black font-mono">
                  {liveCurrentBall?.number || 12}
                </span>
              </div>
            ) : (
              <div className="w-28 h-28 rounded-full bg-[#120524] border-4 border-dashed border-purple-800 flex flex-col items-center justify-center text-yellow-400 font-extrabold text-xs text-center p-2">
                <Clock className="w-6 h-6 mb-1 animate-spin" />
                <span>Starts in 0:{step3Countdown < 10 ? '0' : ''}{step3Countdown}</span>
              </div>
            )}

            {/* History Bubbles */}
            <div className="flex flex-col gap-1.5">
              {recentBalls.slice(1, 4).map((num, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-[#103860] border border-white text-white font-extrabold text-xs flex items-center justify-center shadow"
                >
                  {num}
                </div>
              ))}
            </div>
          </div>

          {/* Stats & AUTO CARD SELECTOR TOGGLE SWITCH */}
          <div className="flex items-center justify-center gap-3 text-xs font-bold text-slate-200">
            <span className="bg-purple-950/80 px-2.5 py-0.5 rounded-full border border-purple-700 font-mono text-[11px]">
              {calledSet.size} Balls Called
            </span>

            {/* AUTO CARD SELECTOR TOGGLE */}
            <div className="flex items-center gap-1.5">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoCardSelector}
                  onChange={(e) => {
                    sound.playClick();
                    setAutoCardSelector(e.target.checked);
                  }}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
              <span className={`text-[10px] font-bold ${autoCardSelector ? 'text-yellow-400 font-black' : 'text-slate-300'}`}>
                Auto Card Selector {autoCardSelector ? '(ON)' : '(OFF)'}
              </span>
            </div>

            <button
              onClick={() => {
                const next = !voiceOn;
                setVoiceOn(next);
                sound.setVoiceEnabled(next);
                if (next && liveCurrentBall) {
                  sound.speakBall(liveCurrentBall.letter, liveCurrentBall.number);
                }
              }}
              className="text-yellow-400 hover:scale-110 transition-transform"
            >
              {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            </button>
          </div>

          <div className="w-full bg-[#120524] py-1.5 rounded-xl border border-purple-800 text-center font-black text-xs text-yellow-400">
            Win - {room?.pot || 17} ETB
          </div>

        </div>

        {/* Right Column: 1-75 Called Board + Card Box */}
        <div className="md:col-span-8 space-y-3">
          
          {/* 1-75 Called Numbers Grid */}
          <div className="bg-[#241338]/90 border border-purple-800/60 p-3 rounded-2xl space-y-2 shadow-xl">
            <div className="flex items-center justify-between text-[11px] font-black text-slate-200">
              <span className="text-yellow-400">Good Luck!!!</span>
              <span className="flex items-center gap-1 font-mono text-yellow-400 bg-purple-950 px-2 py-0.5 rounded border border-purple-700">
                <Users className="w-3 h-3" /> {room?.playerCount || 1} Players
              </span>
            </div>

            {/* 1-75 Rows */}
            <div className="space-y-1 text-[11px]">
              {[
                { letter: 'B', range: [1, 15], color: 'ahun-bingo-header-b' },
                { letter: 'I', range: [16, 30], color: 'ahun-bingo-header-i' },
                { letter: 'N', range: [31, 45], color: 'ahun-bingo-header-n' },
                { letter: 'G', range: [46, 60], color: 'ahun-bingo-header-g' },
                { letter: 'O', range: [61, 75], color: 'ahun-bingo-header-o' },
              ].map(({ letter, range, color }) => (
                <div key={letter} className="flex items-center gap-1">
                  <span className={`w-5 h-5 rounded ${color} font-black text-xs flex items-center justify-center shadow`}>
                    {letter}
                  </span>
                  <div className="grid grid-cols-15 flex-1 gap-0.5">
                    {Array.from({ length: 15 }, (_, i) => range[0] + i).map(num => {
                      const isCalled = calledSet.has(num);
                      const isLatest = liveCurrentBall?.number === num;

                      return (
                        <div
                          key={num}
                          className={`h-5 rounded font-extrabold font-mono text-[9px] flex items-center justify-center transition-all ${
                            isLatest
                              ? 'bg-yellow-400 text-slate-950 font-black scale-110 shadow ring-1 ring-white'
                              : isCalled
                              ? 'bg-rose-600 text-white font-black'
                              : 'bg-[#3b2b52] text-slate-400'
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card Box */}
          <div className="max-w-xs mx-auto bg-[#241338]/90 border border-purple-700/60 p-3 rounded-2xl space-y-2 shadow-xl text-center">
            
            {/* BINGO RULE ALERT BANNER */}
            {isBingoRuleMatched ? (
              <div className="bg-emerald-500 text-slate-950 font-black text-xs p-2 rounded-xl border-2 border-white shadow-lg animate-bounce flex items-center justify-center gap-1">
                <Sparkles className="w-4 h-4 text-slate-950" />
                <span>🎯 BINGO MATCHED! TAP BINGO BUTTON TO CLAIM WIN!</span>
              </div>
            ) : (
              <div className="text-[10px] font-bold text-slate-400 bg-purple-950/60 p-1.5 rounded-lg border border-purple-800">
                Form 5 in a row (Row, Col, Diag, 4 Corners) to unlock Bingo button
              </div>
            )}

            <h4 className="font-extrabold text-sm text-white">
              {safeActiveCard?.name || `Card No. ${safeActiveCard?.id || 72}`}
            </h4>

            {/* B-I-N-G-O Header */}
            <div className="grid grid-cols-5 gap-1 text-center font-black text-xs text-white">
              <span className="py-0.5 rounded ahun-bingo-header-b shadow">B</span>
              <span className="py-0.5 rounded ahun-bingo-header-i shadow">I</span>
              <span className="py-0.5 rounded ahun-bingo-header-n shadow">N</span>
              <span className="py-0.5 rounded ahun-bingo-header-g shadow">G</span>
              <span className="py-0.5 rounded ahun-bingo-header-o shadow">O</span>
            </div>

            {/* 5x5 Matrix */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {(safeActiveCard?.matrix || []).map((row, r) =>
                (row || []).map((cell, c) => {
                  const markedSet = daubedMap[safeActiveCard?.id] || new Set(['FREE']);
                  const isDaubed = markedSet.has(cell.number);
                  const isCalledBySystem = cell.isFree || (isStep4Active && calledSet.has(cell.number));

                  return (
                    <button
                      key={`${r}-${c}`}
                      disabled={cell.isFree || !isCalledBySystem || isGameOver}
                      onClick={() => handleToggleDaub(safeActiveCard.id, cell.number)}
                      title={isCalledBySystem ? 'Click to mark called number' : 'Wait for system to call this number'}
                      className={`h-8 rounded flex items-center justify-center font-extrabold text-xs border shadow-sm transition-all ${
                        cell.isFree
                          ? 'ahun-free-cell'
                          : isDaubed
                          ? 'bg-blue-600 text-white font-black ring-2 ring-white shadow scale-105'
                          : isCalledBySystem
                          ? 'bg-white hover:bg-yellow-300 text-slate-950 border-slate-300 cursor-pointer animate-pulse ring-1 ring-yellow-400'
                          : 'bg-white/90 text-slate-950 border-slate-300 opacity-80 cursor-not-allowed'
                      }`}
                    >
                      {cell.isFree ? 'F' : cell.number}
                    </button>
                  );
                })
              )}
            </div>

            {/* BINGO BUTTON */}
            <button
              disabled={!isBingoRuleMatched || isGameOver || !isStep4Active}
              onClick={() => handleClaimBingo(safeActiveCard.id)}
              title={isBingoRuleMatched ? 'Click to claim Bingo win!' : 'Complete 5 in a row to enable Bingo button'}
              className={`w-full py-2.5 rounded-lg text-xs font-black uppercase tracking-wider shadow-lg transition-all ${
                isGameOver
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                  : !isStep4Active
                  ? 'bg-slate-700 text-slate-400 cursor-not-allowed opacity-50'
                  : isBingoRuleMatched
                  ? 'ahun-bingo-blue-claim-btn animate-bounce ring-4 ring-yellow-400 shadow-2xl scale-105 cursor-pointer text-white font-black'
                  : 'bg-slate-700/60 text-slate-400 cursor-not-allowed opacity-50 border border-slate-600'
              }`}
            >
              {isGameOver ? 'Match Over' : isBingoRuleMatched ? '🎯 BINGO HIT! CLAIM WIN' : 'Bingo (Rules Not Matched)'}
            </button>
          </div>

        </div>

      </div>

      {/* 🎉 WINNER OR LOSER CELEBRATION MODAL */}
      {winnerModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#241338] border-4 border-yellow-400 rounded-3xl max-w-md w-full p-6 text-center space-y-5 shadow-2xl animate-popIn">
            
            <div className={`w-24 h-24 rounded-full flex items-center justify-center text-5xl mx-auto shadow-2xl animate-bounce border-4 border-white ${
              isUserWinner ? 'bg-yellow-400 text-slate-950' : 'bg-rose-600 text-white'
            }`}>
              {isUserWinner ? '🏆' : '❌'}
            </div>

            <div className="space-y-1">
              <span className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shadow ${
                isUserWinner ? 'bg-yellow-400 text-slate-950' : 'bg-rose-600 text-white'
              }`}>
                {isUserWinner ? '🎉 CONGRATULATIONS! YOU WON BINGO!' : 'MATCH FINISHED!'}
              </span>
              <h3 className="text-3xl font-black text-white pt-2">{winnerModal.userName}</h3>
              <p className="text-xs text-yellow-200">
                {isUserWinner ? 'You won' : 'Winner won'} with <strong>Card No. {winnerModal.cardId}</strong> ({winnerModal.pattern})
              </p>
            </div>

            <div className="bg-[#120524] p-5 rounded-2xl border-2 border-yellow-400 space-y-1 shadow-inner">
              <span className="text-[11px] text-slate-400 uppercase font-black tracking-wider block">
                {isUserWinner ? 'TOTAL CASH PRIZE WON' : 'PRIZE AWARDED TO WINNER'}
              </span>
              <p className="text-4xl font-black text-yellow-400 font-mono">
                +{winnerModal.prize} ETB
              </p>
            </div>

            <p className="text-xs text-slate-300">
              Next match countdown will start automatically in 10 seconds!
            </p>

            <button
              onClick={() => {
                sound.playClick();
                setWinnerModal(null);
                onLeaveRoom();
              }}
              className="w-full py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-sm shadow-xl active:scale-95 transition-all"
            >
              Play Next Match
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

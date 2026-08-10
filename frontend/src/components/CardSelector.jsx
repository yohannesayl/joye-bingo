import React, { useState, useEffect } from 'react';
import { Shuffle } from 'lucide-react';
import { sound } from '../services/soundService';
import { generateBingoCard } from '../../../backend/gameEngine.js';

export default function CardSelector({ room, globalSeconds, user, onBuyCard, onClose }) {
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [previewCard, setPreviewCard] = useState(null);
  const [confirmedCardId, setConfirmedCardId] = useState(null);

  // Sync cards taken by other players in this room
  const purchasedCards = room?.purchasedCards || [];
  
  // Set of card numbers TAKEN BY OTHER PLAYERS (Will turn BLUE & NOT SELECTABLE!)
  const takenCardIdsByOthers = new Set(
    purchasedCards
      .filter(cp => cp.userId !== user?.id)
      .map(cp => cp.cardId || cp.card?.id)
  );

  // Cards owned by current user (Turns GREEN!)
  const myConfirmedCardIds = new Set(
    purchasedCards
      .filter(cp => cp.userId === user?.id)
      .map(cp => cp.cardId || cp.card?.id)
  );

  const secondsLeft = globalSeconds !== undefined ? globalSeconds : (room?.countdownSeconds || 31);

  // AUTOMATIC TRANSITION AT 0:00
  useEffect(() => {
    if (secondsLeft <= 0) {
      const autoCardId = selectedCardId || 72;
      onBuyCard(autoCardId);
      onClose();
    }
  }, [secondsLeft, selectedCardId, onBuyCard, onClose]);

  const handleSelectCardNumber = (num) => {
    if (takenCardIdsByOthers.has(num)) return; // Cannot select cards taken by others!

    sound.playClick();
    setSelectedCardId(num);
    const card = generateBingoCard(num);
    setPreviewCard(card);
  };

  const handleConfirmCard = () => {
    sound.playClick();
    const cardToConfirm = selectedCardId || 72;
    setConfirmedCardId(cardToConfirm);
    onBuyCard(cardToConfirm);
    onClose();
  };

  const handleGoBack = () => {
    sound.playClick();
    setPreviewCard(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#1e0a2f]/95 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="max-w-5xl w-full my-auto space-y-4">
        
        {/* Step 2b: Card Preview Screen */}
        {previewCard ? (
          <div className="max-w-md mx-auto space-y-6 text-center animate-popIn">
            
            {/* Unified Green Digital Clock */}
            <div className="digital-clock-green text-4xl font-mono">
              0:{secondsLeft < 10 ? '0' : ''}{secondsLeft}
            </div>

            {/* Stake Pill */}
            <div className="inline-block px-6 py-2 rounded-full bg-slate-800/80 border border-slate-600 text-white font-extrabold text-xs shadow">
              {room?.stake || 10} Birr Per Card
            </div>

            {/* Bonus Banner */}
            <div className="p-2 rounded-xl bg-purple-950/80 border border-yellow-400 text-yellow-400 font-extrabold text-xs">
              ✨ O : +100 Birr
            </div>

            {/* Card Preview Box */}
            <div className="bg-[#2a1740]/90 border border-purple-700/60 rounded-3xl p-6 space-y-4 shadow-2xl">
              <h3 className="font-extrabold text-2xl text-white">
                Card No. {selectedCardId}
              </h3>

              {/* B-I-N-G-O Header Circles */}
              <div className="grid grid-cols-5 gap-2 text-center font-black text-lg text-white">
                <span className="w-10 h-10 rounded-full ahun-bingo-header-b flex items-center justify-center mx-auto shadow">B</span>
                <span className="w-10 h-10 rounded-full ahun-bingo-header-i flex items-center justify-center mx-auto shadow">I</span>
                <span className="w-10 h-10 rounded-full ahun-bingo-header-n flex items-center justify-center mx-auto shadow">N</span>
                <span className="w-10 h-10 rounded-full ahun-bingo-header-g flex items-center justify-center mx-auto shadow">G</span>
                <span className="w-10 h-10 rounded-full ahun-bingo-header-o flex items-center justify-center mx-auto shadow">O</span>
              </div>

              {/* 5x5 Matrix */}
              <div className="grid grid-cols-5 gap-2 text-center">
                {previewCard.matrix.map((row, r) =>
                  row.map((cell, c) => (
                    <div
                      key={`${r}-${c}`}
                      className={`h-11 rounded-lg flex items-center justify-center font-extrabold text-sm border shadow-sm ${
                        cell.isFree
                          ? 'ahun-free-cell'
                          : 'bg-white text-slate-900 border-slate-300'
                      }`}
                    >
                      {cell.isFree ? 'F' : cell.number}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <button
                onClick={handleGoBack}
                className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-sm shadow cursor-pointer active:scale-95 transition-all"
              >
                Go Back
              </button>

              <button
                onClick={handleConfirmCard}
                className="flex-1 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black text-sm shadow cursor-pointer active:scale-95 transition-all"
              >
                Confirm Cards
              </button>
            </div>

          </div>
        ) : (
          /* Step 2a: Card Grid Selection (1 to 252) */
          <div className="space-y-4 animate-popIn">
            
            <div className="flex flex-col items-center justify-center space-y-3 text-center">
              {/* Unified Green Digital Clock */}
              <div className="digital-clock-green text-4xl font-mono">
                0:{secondsLeft < 10 ? '0' : ''}{secondsLeft}
              </div>

              <div className="flex items-center gap-3">
                <span className="px-6 py-2 rounded-full bg-slate-800/80 border border-slate-600 text-white font-extrabold text-xs shadow">
                  {room?.stake || 10} Birr Per Card
                </span>
                <button
                  onClick={() => sound.playClick()}
                  className="p-2.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-black shadow"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
              </div>

              <div className="w-full max-w-xl p-2 rounded-xl bg-purple-950/80 border border-yellow-400 text-yellow-400 font-extrabold text-xs">
                ✨ O : +100 Birr
              </div>
            </div>

            {/* Number Grid 1 to 252 */}
            <div className="bg-[#241338]/90 border border-purple-800/60 p-4 rounded-2xl max-h-[60vh] overflow-y-auto space-y-2">
              <div className="grid grid-cols-7 sm:grid-cols-12 md:grid-cols-16 lg:grid-cols-21 gap-1.5 text-center">
                {Array.from({ length: 252 }, (_, i) => i + 1).map((num) => {
                  const isMyConfirmedCard = confirmedCardId === num || myConfirmedCardIds.has(num);
                  const isTakenByOther = takenCardIdsByOthers.has(num);

                  return (
                    <button
                      key={num}
                      disabled={isTakenByOther}
                      onClick={() => handleSelectCardNumber(num)}
                      title={isTakenByOther ? `Card No. ${num} selected by another player` : `Select Card No. ${num}`}
                      className={`h-9 rounded font-extrabold text-xs flex items-center justify-center transition-all ${
                        isMyConfirmedCard
                          ? 'bg-emerald-600 text-white font-black ring-2 ring-white shadow-lg' // MY CONFIRMED CARD: GREEN!
                          : isTakenByOther
                          ? 'bg-blue-600 text-white font-black opacity-90 cursor-not-allowed shadow-inner' // TAKEN BY OTHER PLAYER: BLUE & NOT SELECTABLE!
                          : 'bg-slate-200 text-slate-950 hover:bg-yellow-300 cursor-pointer font-extrabold' // UNSELECTED CARD: GREY & SELECTABLE!
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span className="text-yellow-400 font-bold">
                Click any number to preview card and click Confirm Cards to start match! (Blue cards are taken by other players)
              </span>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-yellow-400 text-slate-950 font-black"
              >
                Close Picker
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

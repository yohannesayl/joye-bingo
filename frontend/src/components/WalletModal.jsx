import React, { useState, useEffect } from 'react';
import { CreditCard, ArrowDownRight, ArrowUpRight, Copy, Check, QrCode, X, Share2, History, Send } from 'lucide-react';
import { sound } from '../services/soundService';

export default function WalletModal({ user, onClose, onRefreshUser }) {
  const [activeTab, setActiveTab] = useState('deposit');
  const [amount, setAmount] = useState('100');
  const [method, setMethod] = useState('Telebirr');
  const [phone, setPhone] = useState('0911223344');
  const [txRef, setTxRef] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    fetchWalletData();
  }, [user?.id]);

  const fetchWalletData = async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`/api/wallet/${user.id}`);
      const data = await res.json();
      setTransactions(data.transactions || []);
    } catch (e) {
      console.error('Error fetching wallet:', e);
    }
  };

  const handleDeposit = async (e) => {
    e.preventDefault();
    sound.playClick();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/wallet/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: parseFloat(amount),
          method,
          reference: txRef || `TLB-${Math.floor(10000000 + Math.random() * 90000000)}`
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `Successfully deposited ${amount} ETB via ${method}!` });
        sound.playWinFanfare();
        onRefreshUser();
        fetchWalletData();
      } else {
        setMsg({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Deposit failed. Try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    sound.playClick();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          amount: parseFloat(amount),
          method,
          phoneNumber: phone
        })
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'success', text: `Withdrawal request for ${amount} ETB sent to ${phone}!` });
        sound.playClick();
        onRefreshUser();
        fetchWalletData();
      } else {
        setMsg({ type: 'error', text: data.error });
      }
    } catch (err) {
      setMsg({ type: 'error', text: 'Withdrawal failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReferral = () => {
    sound.playClick();
    navigator.clipboard.writeText(`https://t.me/kartabingobot?start=${user?.referralCode || 'KARTA100'}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-popIn">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-white">Karta Cash Wallet</h3>
              <p className="text-xs text-amber-400 font-bold">Balance: {user?.balance || 0} ETB</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center border-b border-slate-800 bg-slate-950/60 p-2 gap-1">
          {['deposit', 'withdraw', 'history', 'referral'].map(tab => (
            <button
              key={tab}
              onClick={() => { sound.playClick(); setActiveTab(tab); setMsg(null); }}
              className={`flex-1 py-2 text-xs font-extrabold rounded-xl capitalize transition-all ${
                activeTab === tab
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {msg && (
            <div className={`p-3 rounded-xl text-xs font-bold ${
              msg.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}>
              {msg.text}
            </div>
          )}

          {activeTab === 'deposit' && (
            <form onSubmit={handleDeposit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Payment Method</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Telebirr', 'CBE Birr'].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      className={`p-3 rounded-xl font-extrabold text-xs border text-center transition-all ${
                        method === m
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {/* QR Code / Pay details */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <QrCode className="w-10 h-10" />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-extrabold text-white">Telebirr Merchant Code</p>
                  <p className="font-mono text-amber-400 font-bold text-sm">778899</p>
                  <p className="text-slate-400 text-[11px]">Instant automated deposit confirmation</p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Amount (ETB)</label>
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {['50', '100', '200', '500'].map(a => (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setAmount(a)}
                      className={`py-1.5 rounded-lg text-xs font-bold border ${
                        amount === a ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-slate-950 text-slate-300 border-slate-800'
                      }`}
                    >
                      {a} ETB
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gold-gradient text-slate-950 font-black text-sm shadow-md hover:opacity-95 transition-all"
              >
                {loading ? 'Processing...' : `Deposit ${amount} ETB`}
              </button>
            </form>
          )}

          {activeTab === 'withdraw' && (
            <form onSubmit={handleWithdraw} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Telebirr Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0911..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-400 uppercase">Amount to Withdraw (ETB)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm shadow-md transition-all"
              >
                {loading ? 'Processing...' : `Request Payout of ${amount} ETB`}
              </button>
            </form>
          )}

          {activeTab === 'history' && (
            <div className="space-y-2">
              {transactions.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No transaction records found</p>
              ) : (
                transactions.map(t => (
                  <div key={t.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      {t.type === 'DEPOSIT' || t.type === 'WIN' ? (
                        <ArrowDownRight className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 text-rose-400" />
                      )}
                      <div>
                        <p className="font-bold text-white">{t.method} ({t.type})</p>
                        <p className="text-[10px] text-slate-500">{t.reference}</p>
                      </div>
                    </div>
                    <span className={`font-black font-mono ${t.type === 'DEPOSIT' || t.type === 'WIN' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {t.type === 'DEPOSIT' || t.type === 'WIN' ? '+' : '-'}{t.amount} ETB
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'referral' && (
            <div className="space-y-4 text-center">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2">
                <Share2 className="w-8 h-8 text-amber-400 mx-auto" />
                <h4 className="font-extrabold text-white text-base">Invite Friends & Earn 20 ETB!</h4>
                <p className="text-xs text-slate-300">
                  Share your referral link with friends. Get 20 Birr free bonus for every friend who joins!
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <span className="text-xs font-mono text-amber-400 font-bold">
                  Code: {user?.referralCode || 'KARTA100'}
                </span>
                <button
                  onClick={handleCopyReferral}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-extrabold text-xs flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied Link' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

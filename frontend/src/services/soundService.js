class SoundService {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
    this.voiceEnabled = true;
    this.language = 'am'; // 'am' (Amharic) or 'en' (English)
    this.voices = [];
    
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    }
  }

  loadVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  initContext() {
    if (typeof window === 'undefined') return;
    
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    if ('speechSynthesis' in window) {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    }
  }

  playClick() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.audioCtx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.05);
    } catch (e) {}
  }

  playBallPop() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.35, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.14);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.14);
    } catch (e) {}
  }

  playDaubSound() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    try {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, this.audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      osc.stop(this.audioCtx.currentTime + 0.08);
    } catch (e) {}
  }

  playWinFanfare() {
    if (this.muted) return;
    this.initContext();
    if (!this.audioCtx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50];
    notes.forEach((freq, index) => {
      try {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime + index * 0.12);

        gain.gain.setValueAtTime(0.4, this.audioCtx.currentTime + index * 0.12);
        gain.gain.linearRampToValueAtTime(0.01, this.audioCtx.currentTime + index * 0.12 + 0.3);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(this.audioCtx.currentTime + index * 0.12);
        osc.stop(this.audioCtx.currentTime + index * 0.12 + 0.3);
      } catch (e) {}
    });
  }

  // GUARANTEE LOUD & CLEAR B-I-N-G-O LETTER SPEECH IN AMHARIC & ENGLISH!
  speakBall(letter, number) {
    if (this.muted || !this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    try {
      window.speechSynthesis.cancel();

      // Automatically determine letter if not provided
      let ballLetter = letter;
      if (!ballLetter) {
        const num = parseInt(number, 10);
        ballLetter = num <= 15 ? 'B' : num <= 30 ? 'I' : num <= 45 ? 'N' : num <= 60 ? 'G' : 'O';
      }

      // Phonetic pronunciation map so TTS engines NEVER swallow the letter!
      const amharicPhonetics = {
        'B': 'ቢ',
        'I': 'አይ',
        'N': 'ኤን',
        'G': 'ጂ',
        'O': 'ኦ'
      };

      const englishPhonetics = {
        'B': 'Bee',
        'I': 'Eye',
        'N': 'En',
        'G': 'Gee',
        'O': 'Oh'
      };

      let spokenText = '';
      if (this.language === 'am') {
        const amLetter = amharicPhonetics[ballLetter] || ballLetter;
        spokenText = `${amLetter} ${number}`;
      } else {
        const enLetter = englishPhonetics[ballLetter] || ballLetter;
        spokenText = `${enLetter} ${number}`;
      }

      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.85; // Slightly slower for crisp clarity
      utterance.pitch = 1.1;
      utterance.volume = 1.0;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error('Speech synthesis error:', e);
    }
  }

  setMuted(muted) {
    this.muted = muted;
  }

  setVoiceEnabled(enabled) {
    this.voiceEnabled = enabled;
  }

  setLanguage(lang) {
    this.language = lang;
  }
}

export const sound = new SoundService();

/**
 * Web Audio API Sound Synthesizer
 * Generates instant crisp acoustic signals without loading external audio files or MP3s.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Unlocks audio on PIN tap or user gesture with an inaudible prime pulse
 */
export async function forceUnlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    // Play 5ms inaudible buffer to permanently clear browser autoplay restrictions
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    return true;
  } catch (err) {
    console.warn('Audio unlock warning:', err);
    return false;
  }
}

export function isAudioUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  if (!audioCtx) return false;
  return audioCtx.state === 'running';
}

export function unlockAudio() {
  forceUnlockAudio();
}

/**
 * 1. Kitchen Bell: Loud, resonant dual-chime (880Hz + 1174Hz)
 */
export function playKitchenBell() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc1 = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const gain = ctx.createGain();

  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(880, now); // A5

  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(1174.66, now); // D6

  gain.gain.setValueAtTime(0.8, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  osc1.connect(gain);
  osc2.connect(gain);
  gain.connect(ctx.destination);

  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 1.2);
  osc2.stop(now + 1.2);
}

/**
 * 2. Waiter Alert: Urgent double vibration ping (587Hz + 880Hz)
 */
export function playWaiterAlert() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(587.33, now); // D5
  osc.frequency.setValueAtTime(880, now + 0.15); // A5

  gain.gain.setValueAtTime(0.4, now);
  gain.gain.setValueAtTime(0.0, now + 0.12);
  gain.gain.setValueAtTime(0.4, now + 0.15);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.6);

  // Vibration on mobile devices if supported
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200]);
  }
}

/**
 * 3. Service Call (Water/Cutlery): Soft polite double ping (659Hz + 784Hz)
 */
export function playServiceChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(659.25, now); // E5
  osc.frequency.setValueAtTime(783.99, now + 0.18); // G5

  gain.gain.setValueAtTime(0.5, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.8);

  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(150);
  }
}

/**
 * 4. Success / Paid Chime: Upward joyful arpeggio (C-E-G-C)
 */
export function playSuccessChime() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const freqs = [523.25, 659.25, 783.99, 1046.5];
  const now = ctx.currentTime;

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0.3, now + idx * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.5);
  });
}

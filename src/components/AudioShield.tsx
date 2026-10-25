'use client';

import React, { useState, useEffect } from 'react';
import { BellRing, Volume2 } from 'lucide-react';
import { forceUnlockAudio, isAudioUnlocked } from '@/lib/audio-synth';

interface AudioShieldProps {
  label?: string;
}

export default function AudioShield({
  label = 'Tap to Arm Kitchen Bell & Sound Alerts',
}: AudioShieldProps) {
  const [isArmed, setIsArmed] = useState(true);

  useEffect(() => {
    // Check initial state
    const unlocked = isAudioUnlocked();
    setIsArmed(unlocked);

    // Global listener: any interaction automatically clears browser autoplay block
    const handleFirstGesture = async () => {
      const ok = await forceUnlockAudio();
      if (ok) {
        setIsArmed(true);
        window.removeEventListener('pointerdown', handleFirstGesture);
        window.removeEventListener('keydown', handleFirstGesture);
      }
    };

    if (!unlocked) {
      window.addEventListener('pointerdown', handleFirstGesture, { once: true });
      window.addEventListener('keydown', handleFirstGesture, { once: true });
    }

    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  const handleManualArm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const ok = await forceUnlockAudio();
    if (ok) {
      setIsArmed(true);
    }
  };

  if (isArmed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-bounce">
      <button
        onClick={handleManualArm}
        className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-2xl shadow-2xl border-2 border-white transition transform active:scale-95"
      >
        <BellRing className="w-4 h-4 text-slate-950 animate-pulse" />
        <span>{label}</span>
        <Volume2 className="w-3.5 h-3.5 opacity-70" />
      </button>
    </div>
  );
}

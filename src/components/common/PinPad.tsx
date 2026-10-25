'use client';

import React, { useState } from 'react';
import { unlockAudio } from '@/lib/audio-synth';

interface PinPadProps {
  title?: string;
  subtitle?: string;
  onSuccess: (pin: string) => void;
  expectedLength?: number;
  error?: string | null;
  buttonText?: string;
}

export function PinPad({
  title = 'ENTER 4-DIGIT PIN',
  subtitle,
  onSuccess,
  expectedLength = 4,
  error,
  buttonText = 'LOGIN ➔',
}: PinPadProps) {
  const [pin, setPin] = useState('');

  const handleDigit = (digit: string) => {
    unlockAudio();
    if (pin.length < expectedLength) {
      const nextPin = pin + digit;
      setPin(nextPin);
      if (nextPin.length === expectedLength) {
        onSuccess(nextPin);
      }
    }
  };

  const handleClear = () => {
    unlockAudio();
    setPin('');
  };

  const handleDelete = () => {
    unlockAudio();
    setPin((prev) => prev.slice(0, -1));
  };

  const handleManualSubmit = () => {
    unlockAudio();
    if (pin.length === expectedLength) {
      onSuccess(pin);
    }
  };

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col items-center">
      {title && <h3 className="text-sm font-bold tracking-wider text-slate-300 uppercase mb-1">{title}</h3>}
      {subtitle && <p className="text-xs text-slate-400 mb-4">{subtitle}</p>}

      {/* PIN Dots Indicator */}
      <div className="flex gap-4 mb-6">
        {Array.from({ length: expectedLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? 'bg-amber-400 border-amber-400 scale-110 shadow-md shadow-amber-400/50'
                : 'border-slate-500 bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <div className="text-red-400 text-xs font-medium mb-3 animate-bounce">{error}</div>}

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full mb-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xl font-bold border border-slate-700/80 shadow-sm transition flex items-center justify-center select-none"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 active:scale-95 text-xs font-bold border border-slate-700/50 transition flex items-center justify-center select-none"
        >
          CLR
        </button>
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white text-xl font-bold border border-slate-700/80 shadow-sm transition flex items-center justify-center select-none"
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className="h-14 rounded-2xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 active:scale-95 text-sm font-bold border border-slate-700/50 transition flex items-center justify-center select-none"
        >
          ⌫
        </button>
      </div>

      {/* Login Button */}
      <button
        type="button"
        onClick={handleManualSubmit}
        disabled={pin.length < expectedLength}
        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition shadow-lg select-none ${
          pin.length === expectedLength
            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-98'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
}

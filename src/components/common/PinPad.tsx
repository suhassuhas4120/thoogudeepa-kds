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
  variant?: 'dark' | 'light';
}

export function PinPad({
  title = 'ENTER 4-DIGIT PIN',
  subtitle,
  onSuccess,
  expectedLength = 4,
  error,
  buttonText = 'LOGIN ➔',
  variant = 'dark',
}: PinPadProps) {
  const [pin, setPin] = useState('');
  const isLight = variant === 'light';

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
      {title && (
        <h3 className={`text-sm font-bold tracking-wider uppercase mb-1 ${isLight ? 'text-stone-900' : 'text-slate-300'}`}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className={`text-xs mb-4 ${isLight ? 'text-stone-500' : 'text-slate-400'}`}>
          {subtitle}
        </p>
      )}

      {/* PIN Dots Indicator */}
      <div className="flex gap-4 mb-6">
        {Array.from({ length: expectedLength }).map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-200 ${
              i < pin.length
                ? isLight
                  ? 'bg-[#8A4228] border-[#8A4228] scale-110 shadow-sm'
                  : 'bg-amber-400 border-amber-400 scale-110 shadow-md shadow-amber-400/50'
                : isLight
                ? 'border-stone-300 bg-white'
                : 'border-slate-500 bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <div className="text-red-500 text-xs font-medium mb-3 animate-bounce">{error}</div>}

      {/* Numpad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full mb-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className={`h-12 rounded-xl active:scale-95 text-lg font-bold shadow-xs transition flex items-center justify-center select-none ${
              isLight
                ? 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-200'
                : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80'
            }`}
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={handleClear}
          className={`h-12 rounded-xl active:scale-95 text-xs font-bold transition flex items-center justify-center select-none ${
            isLight
              ? 'bg-white hover:bg-red-50 text-red-500 border border-stone-200'
              : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400 border border-slate-700/50'
          }`}
        >
          CLR
        </button>
        <button
          type="button"
          onClick={() => handleDigit('0')}
          className={`h-12 rounded-xl active:scale-95 text-lg font-bold shadow-xs transition flex items-center justify-center select-none ${
            isLight
              ? 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-200'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700/80'
          }`}
        >
          0
        </button>
        <button
          type="button"
          onClick={handleDelete}
          className={`h-12 rounded-xl active:scale-95 text-sm font-bold transition flex items-center justify-center select-none ${
            isLight
              ? 'bg-white hover:bg-stone-50 text-stone-700 border border-stone-200'
              : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400 border border-slate-700/50'
          }`}
        >
          DEL
        </button>
      </div>

      {/* Login Button */}
      <button
        type="button"
        onClick={handleManualSubmit}
        disabled={pin.length < expectedLength}
        className={`w-full py-3.5 rounded-xl font-bold text-sm tracking-wide transition shadow-xs select-none ${
          pin.length === expectedLength
            ? isLight
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-white cursor-pointer active:scale-98'
              : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20 active:scale-98'
            : isLight
            ? 'bg-stone-200 text-stone-400 cursor-not-allowed'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
        }`}
      >
        {buttonText}
      </button>
    </div>
  );
}

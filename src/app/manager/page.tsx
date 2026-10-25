'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playSuccessChime } from '@/lib/audio-synth';

export default function ManagerLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'MANAGER', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        router.push('/manager/floor');
      } else {
        setError(data.error || 'Invalid Manager PIN (Try 9999)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6">
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-purple-400 uppercase">
          EXECUTIVE CONTROL CENTER
        </span>
        <div className="w-24 h-24 rounded-full border-4 border-purple-500 bg-purple-500/10 flex items-center justify-center mx-auto my-3 shadow-xl shadow-purple-500/20">
          <ShieldCheck className="w-10 h-10 text-purple-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white">
          THOOGUDEEPA DONNE BIRYANI
        </h1>
        <p className="text-xs text-slate-400 mt-1">General Manager Portal</p>
      </div>

      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <PinPad
          title="MANAGER ACCESS PIN"
          subtitle="Enter 4-digit PIN to access Executive Cockpit"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="ACCESS SYSTEM ➔"
        />
      </div>

      <div className="mt-8 text-xs text-slate-500">
        Default Manager PIN: <strong className="text-slate-400">9999</strong>
      </div>
    </div>
  );
}

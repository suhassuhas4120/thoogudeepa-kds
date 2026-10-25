'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChefHat } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playKitchenBell } from '@/lib/audio-synth';

export default function KitchenLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'KITCHEN', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playKitchenBell();
        router.push('/kitchen/kds');
      } else {
        setError(data.error || 'Invalid Chef PIN (Try 3333)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6">
      {/* Top Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-emerald-400 uppercase">
          THOOGUDEEPA KDS
        </span>
        <div className="w-28 h-28 rounded-full border-4 border-emerald-500 bg-emerald-500/10 flex items-center justify-center mx-auto my-4 shadow-xl shadow-emerald-500/20">
          <ChefHat className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white tracking-wider">
          THOOGUDEEPA DONNE BIRYANI MANE
        </h1>
        <p className="text-xs text-slate-400 mt-1">Kitchen Display System (Chef Terminal)</p>
      </div>

      {/* PIN Pad Component */}
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <PinPad
          title="KITCHEN ACCESS PIN"
          subtitle="Enter 4-digit chef PIN to unlock live tickets & audio"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="LOGIN TO KDS ➔"
        />
      </div>

      <div className="mt-8 text-xs text-slate-500">
        Default Chef PIN: <strong className="text-slate-400">3333</strong>
      </div>
    </div>
  );
}

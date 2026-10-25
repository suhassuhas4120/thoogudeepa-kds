'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Smartphone } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playWaiterAlert } from '@/lib/audio-synth';

export default function WaiterSuhasLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName: 'Suhas', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playWaiterAlert();
        router.push('/waiter/suhas/floor');
      } else {
        setError(data.error || 'Invalid PIN for Suhas (Try 1111)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-center items-center p-6 max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-blue-400 uppercase">
          ZONE A (SEATS 1 – 8)
        </span>
        <div className="w-24 h-24 rounded-full border-4 border-blue-500 bg-blue-500/10 flex items-center justify-center mx-auto my-3 shadow-xl shadow-blue-500/20">
          <Smartphone className="w-10 h-10 text-blue-400" />
        </div>
        <h1 className="text-xl font-extrabold text-white">
          THOOGUDEEPA DONNE BIRYANI
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          🤵 Waiter Mobile Terminal: <strong className="text-white">Suhas</strong>
        </p>
      </div>

      {/* PIN Pad */}
      <div className="w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl">
        <PinPad
          title="SUHAS ACCESS PIN"
          subtitle="Enter 4-digit PIN to access Seats 1 to 8"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="LOGIN TO FLOOR ➔"
        />
      </div>

      <div className="mt-8 text-xs text-slate-500">
        Default Suhas PIN: <strong className="text-slate-400">1111</strong>
      </div>
    </div>
  );
}

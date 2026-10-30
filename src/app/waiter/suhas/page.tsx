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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col justify-center items-center p-6 max-w-md mx-auto select-none font-sans">
      {/* Header */}
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-[#8A4228] uppercase font-bold">
          ZONE A (SEATS 1 – 8)
        </span>
        <div className="w-24 h-24 rounded-full border-4 border-[#8A4228] bg-[#8A4228]/10 flex items-center justify-center mx-auto my-3 shadow-xs">
          <Smartphone className="w-10 h-10 text-[#8A4228]" />
        </div>
        <h1 className="text-xl font-black text-stone-900">
          THOOGUDEEPA DONNE BIRYANI
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          🤵 Waiter Mobile Terminal: <strong className="text-stone-900">Suhas</strong>
        </p>
      </div>

      {/* PIN Pad */}
      <div className="w-full bg-white border border-stone-200 rounded-3xl p-6 shadow-xs">
        <PinPad
          variant="light"
          title="SUHAS ACCESS PIN"
          subtitle="Enter 4-digit PIN to access Seats 1 to 8"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="LOGIN TO FLOOR ➔"
        />
      </div>

      <div className="mt-8 text-xs text-stone-500">
        Default Suhas PIN: <strong className="text-stone-700">1111</strong>
      </div>
    </div>
  );
}

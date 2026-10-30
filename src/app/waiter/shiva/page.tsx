'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Tablet } from 'lucide-react';
import { PinPad } from '@/components/common/PinPad';
import { unlockAudio, playWaiterAlert } from '@/lib/audio-synth';

export default function WaiterShivaLoginScreen() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const handlePinSubmit = async (pin: string) => {
    unlockAudio();
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffName: 'Shiva', pin }),
      });
      const data = await res.json();
      if (data.success) {
        playWaiterAlert();
        router.push('/waiter/shiva/floor');
      } else {
        setError(data.error || 'Invalid PIN for Shiva (Try 2222)');
      }
    } catch (e) {
      setError('Connection error');
    }
  };

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col justify-center items-center p-6 select-none font-sans">
      <div className="text-center mb-8">
        <span className="text-xs font-black tracking-widest text-[#8A4228] uppercase font-bold">
          ZONE B (SEATS 9 – 16)
        </span>
        <div className="w-24 h-24 rounded-full border-4 border-[#8A4228] bg-[#8A4228]/10 flex items-center justify-center mx-auto my-3 shadow-xs">
          <Tablet className="w-10 h-10 text-[#8A4228]" />
        </div>
        <h1 className="text-xl font-black text-stone-900">
          THOOGUDEEPA DONNE BIRYANI
        </h1>
        <p className="text-xs text-stone-500 mt-1">
          📟 Waiter Tablet Terminal: <strong className="text-stone-900">Shiva</strong>
        </p>
      </div>

      <div className="w-full max-w-sm bg-white border border-stone-200 rounded-3xl p-6 shadow-xs">
        <PinPad
          variant="light"
          title="SHIVA TABLET ACCESS PIN"
          subtitle="Enter 4-digit PIN to access Seats 9 to 16"
          onSuccess={handlePinSubmit}
          error={error}
          buttonText="LOGIN TO TABLET FLOOR ➔"
        />
      </div>

      <div className="mt-8 text-xs text-stone-500">
        Default Shiva PIN: <strong className="text-stone-700">2222</strong>
      </div>
    </div>
  );
}

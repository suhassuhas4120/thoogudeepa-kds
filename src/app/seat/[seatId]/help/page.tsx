'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Droplet, RotateCcw, UtensilsCrossed, UserCheck, CheckCircle2, Clock, BellRing, ArrowLeft } from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playServiceChime } from '@/lib/audio-synth';
import { useCustomerTheme } from '@/lib/useCustomerTheme';
import { ThemeToggle } from '@/components/ThemeToggle';

interface ServiceItem {
  id: string;
  type: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
}

export default function CustomerScreen8({ params }: { params: { seatId: string } }) {
  const seatId = parseInt(params.seatId, 10);
  const isZoneA = seatId <= 8;
  const assignedWaiter = isZoneA ? 'Suhas' : 'Shiva';
  const socket = useSocketRoom(`room:seat:${seatId}`);
  const { theme, toggleTheme } = useCustomerTheme();
  const isOrange = theme === 'burnt-orange';

  const [customerName, setCustomerName] = useState('-');
  const [selectedType, setSelectedType] = useState<string>('Water');
  const [lastRequestTime, setLastRequestTime] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<'IDLE' | 'PENDING' | 'RESOLVED'>('IDLE');
  const [lastRequestedType, setLastRequestedType] = useState<string>('Water');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/api/seats/${seatId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.activeSession) {
          const sess = data.data.activeSession;
          setCustomerName(sess.customerName || '-');
          if (sess.serviceRequests && sess.serviceRequests.length > 0) {
            const req = sess.serviceRequests[0];
            setRequestStatus(req.status);
            setLastRequestedType(req.requestType);
            setLastRequestTime(
              new Date(req.requestedAt).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
            );
          }
        }
      });
  }, [seatId]);

  useEffect(() => {
    if (!socket) return;

    const handleResolved = (data: { status: 'RESOLVED'; requestType: string }) => {
      setRequestStatus('RESOLVED');
      playServiceChime();
    };

    socket.on('service:resolved', handleResolved);
    return () => {
      socket.off('service:resolved', handleResolved);
    };
  }, [socket]);

  const options: ServiceItem[] = [
    {
      id: 'Water',
      type: 'Water',
      label: 'Drinking Water',
      sublabel: 'Fresh water / glasses',
      icon: <Droplet className={`w-6 h-6 ${isOrange ? 'text-[#2563EB]' : 'text-cyan-400'}`} />,
    },
    {
      id: 'Clean Seat',
      type: 'Clean Seat',
      label: 'Clean Seat',
      sublabel: 'Seat & dining area wipe',
      icon: <RotateCcw className={`w-6 h-6 ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`} />,
    },
    {
      id: 'Extra plates',
      type: 'Extra plates',
      label: 'Extra Plates',
      sublabel: 'Donne bowls & cutlery',
      icon: <UtensilsCrossed className={`w-6 h-6 ${isOrange ? 'text-[#198754]' : 'text-emerald-400'}`} />,
    },
    {
      id: 'Call waiter Directly',
      type: 'Call waiter Directly',
      label: `Call ${assignedWaiter}`,
      sublabel: 'Assistance at seat',
      icon: <UserCheck className={`w-6 h-6 ${isOrange ? 'text-[#D08A52]' : 'text-amber-300'}`} />,
    },
  ];

  const handleSendRequest = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      const res = await fetch('/api/service-request/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seatId,
          requestType: selectedType,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setRequestStatus('PENDING');
        setLastRequestedType(selectedType);
        setLastRequestTime(timeStr);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 max-w-md mx-auto font-sans select-none relative transition-colors duration-300 ${
        isOrange ? 'bg-[#FFFCF7] text-[#5B5049]' : 'bg-gradient-to-b from-[#04120d] via-[#081e16] to-[#04110c] text-white'
      }`}
    >
      {/* Top Bar */}
      <div>
        <header
          className={`flex items-center justify-between pb-3 border-b ${
            isOrange ? 'border-[#E8D5C3]' : 'border-emerald-500/20'
          }`}
        >
          <div className="flex items-center gap-3">
            <Link
              href={`/seat/${seatId}/menu`}
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold transition ${
                isOrange
                  ? 'bg-[#F3DFCC] text-[#8A4228] hover:bg-[#ebd5c0]'
                  : 'bg-[#0b2d21] border border-emerald-500/30 text-amber-400 hover:bg-[#0f3d2d]'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-black ${isOrange ? 'text-[#8A4228]' : 'text-amber-400'}`}>
                  SEAT {String(seatId).padStart(2, '0')}
                </span>
                {customerName !== '-' && (
                  <span className={`text-[11px] font-bold ${isOrange ? 'text-[#D08A52]' : 'text-emerald-300'}`}>
                    ({customerName})
                  </span>
                )}
              </div>
              <p className={`text-[9px] font-bold tracking-wider uppercase ${isOrange ? 'text-[#5B5049]/70' : 'text-emerald-400/80'}`}>
                Waiter Call Service
              </p>
            </div>
          </div>

          <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
        </header>

        {/* Content */}
        <div className="pt-4 space-y-4">
          <div>
            <span
              className={`text-[11px] font-black uppercase tracking-wider block ${
                isOrange ? 'text-[#D08A52]' : 'text-amber-400'
              }`}
            >
              Quick Assistance
            </span>
            <h2 className={`text-2xl font-black mt-0.5 ${isOrange ? 'text-[#5B5049]' : 'text-white'}`}>
              How Can We Help You?
            </h2>
            <p className={`text-xs mt-1 ${isOrange ? 'text-[#5B5049]/80' : 'text-emerald-300/80'}`}>
              Select a service below to alert {assignedWaiter} on duty.
            </p>
          </div>

          {/* 4 Touch Service Cards */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {options.map((opt) => {
              const isSelected = selectedType === opt.type;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSelectedType(opt.type)}
                  className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all duration-200 active:scale-95 shadow-sm ${
                    isSelected
                      ? isOrange
                        ? 'bg-[#F3DFCC] border-[#8A4228] ring-2 ring-[#8A4228]/25 shadow-md'
                        : 'bg-gradient-to-b from-[#0e3b2b] to-[#08281d] border-amber-400 ring-2 ring-amber-400/30'
                      : isOrange
                      ? 'bg-[#FFFCF7] border-[#E8D5C3] hover:border-[#D08A52]'
                      : 'bg-[#082218] border-emerald-500/25 hover:border-emerald-400/50'
                  }`}
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 border ${
                      isOrange ? 'bg-[#FFFCF7] border-[#E8D5C3]' : 'bg-[#051711] border-emerald-500/20'
                    }`}
                  >
                    {opt.icon}
                  </div>
                  <div>
                    <h4
                      className={`font-extrabold text-sm leading-tight ${
                        isOrange ? 'text-[#5B5049]' : 'text-white'
                      }`}
                    >
                      {opt.label}
                    </h4>
                    <span
                      className={`text-[10px] font-medium block mt-0.5 ${
                        isOrange ? 'text-[#5B5049]/70' : 'text-emerald-300/70'
                      }`}
                    >
                      {opt.sublabel}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Request Live Status Feedback Banner */}
          {requestStatus !== 'IDLE' && (
            <div
              className={`mt-4 p-4 rounded-2xl border transition shadow-sm ${
                requestStatus === 'RESOLVED'
                  ? isOrange
                    ? 'bg-[#F3DFCC] border-[#198754]'
                    : 'bg-[#09291f] border-emerald-400/50'
                  : isOrange
                  ? 'bg-[#F3DFCC] border-[#F59E0B]'
                  : 'bg-[#072017] border-amber-400/30'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  {requestStatus === 'RESOLVED' ? (
                    <CheckCircle2 className="w-5 h-5 text-[#198754]" />
                  ) : (
                    <Clock className="w-5 h-5 text-[#F59E0B] animate-pulse" />
                  )}
                </div>
                <div>
                  <h4
                    className={`font-black text-xs ${
                      isOrange ? 'text-[#5B5049]' : 'text-white'
                    }`}
                  >
                    {requestStatus === 'RESOLVED'
                      ? `Request Attended by ${assignedWaiter} ✓`
                      : `Request Sent: ${lastRequestedType}`}
                  </h4>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      isOrange ? 'text-[#5B5049]/80' : 'text-emerald-300/80'
                    }`}
                  >
                    {requestStatus === 'RESOLVED'
                      ? 'Your request has been resolved. Let us know if you need anything else!'
                      : `${assignedWaiter} has received your bell at ${lastRequestTime || 'just now'} and is coming.`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Button */}
      <div className="pt-4">
        <button
          type="button"
          onClick={handleSendRequest}
          disabled={loading}
          className={`w-full py-4 rounded-2xl active:scale-95 font-black text-sm flex items-center justify-center gap-2 shadow-xl transition select-none ${
            isOrange
              ? 'bg-[#8A4228] hover:bg-[#71351F] text-[#FFFCF7]'
              : 'bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-slate-950 border border-white/20'
          }`}
        >
          <BellRing className="w-4 h-4 stroke-[2.5]" />
          <span>{loading ? 'Alerting Waiter...' : `Alert ${assignedWaiter} for ${selectedType}`}</span>
        </button>
      </div>
    </div>
  );
}

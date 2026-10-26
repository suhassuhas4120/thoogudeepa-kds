'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Tag,
  Plus,
  Clock,
  Calendar,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Edit,
  CheckCircle2,
  Percent,
  Sliders,
  LogOut
} from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';

interface PromoCodeItem {
  id: string;
  code: string;
  discountType: 'FLAT' | 'PERCENTAGE';
  value: number;
  minOrderValue: number;
  maxDiscount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek: string;
  usageLimit?: number | null;
  timesUsed: number;
  isActive: boolean;
}

interface PromoCardItem {
  id: string;
  title: string;
  subtitle: string;
  badgeText?: string | null;
  promoCodeId?: string | null;
  promoCode?: PromoCodeItem | null;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  daysOfWeek: string;
  isActive: boolean;
}

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

export default function ManagerPromosScreen() {
  const socket = useSocketRoom('room:manager');
  const [activeTab, setActiveTab] = useState<'CARDS' | 'CODES'>('CARDS');
  const [promoCodes, setPromoCodes] = useState<PromoCodeItem[]>([]);
  const [promoCards, setPromoCards] = useState<PromoCardItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Card Modal State
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<PromoCardItem | null>(null);
  const [cardForm, setCardForm] = useState({
    title: '',
    subtitle: '',
    badgeText: 'SPECIAL OFFER',
    promoCodeId: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: 'ALL',
  });

  // Code Modal State
  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<PromoCodeItem | null>(null);
  const [codeForm, setCodeForm] = useState({
    code: '',
    discountType: 'FLAT' as 'FLAT' | 'PERCENTAGE',
    value: '',
    minOrderValue: '0',
    maxDiscount: '',
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    daysOfWeek: 'ALL',
  });

  const fetchPromos = async () => {
    try {
      const res = await fetch('/api/promos');
      const data = await res.json();
      if (data.success) {
        setPromoCodes(data.data.promoCodes);
        setPromoCards(data.data.promoCards);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPromos();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchPromos();
    socket.on('promos:updated', handleUpdate);
    return () => {
      socket.off('promos:updated', handleUpdate);
    };
  }, [socket]);

  // Card Actions
  const openNewCardModal = () => {
    setEditingCard(null);
    setCardForm({
      title: '',
      subtitle: '',
      badgeText: 'SPECIAL OFFER',
      promoCodeId: promoCodes[0]?.id || '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      daysOfWeek: 'ALL',
    });
    setIsCardModalOpen(true);
  };

  const openEditCardModal = (card: PromoCardItem) => {
    setEditingCard(card);
    setCardForm({
      title: card.title,
      subtitle: card.subtitle,
      badgeText: card.badgeText || 'SPECIAL OFFER',
      promoCodeId: card.promoCodeId || '',
      startDate: card.startDate ? card.startDate.split('T')[0] : '',
      endDate: card.endDate ? card.endDate.split('T')[0] : '',
      startTime: card.startTime || '',
      endTime: card.endTime || '',
      daysOfWeek: card.daysOfWeek || 'ALL',
    });
    setIsCardModalOpen(true);
  };

  const handleSaveCard = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const action = editingCard ? 'UPDATE_PROMO_CARD' : 'CREATE_PROMO_CARD';
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          promoCard: {
            ...(editingCard && { id: editingCard.id }),
            ...cardForm,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        setIsCardModalOpen(false);
        fetchPromos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCard = async (card: PromoCardItem) => {
    try {
      await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_CARD',
          promoCard: { id: card.id, isActive: !card.isActive },
        }),
      });
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Delete this promotional card?')) return;
    try {
      await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_PROMO_CARD',
          promoCard: { id },
        }),
      });
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  // Code Actions
  const openNewCodeModal = () => {
    setEditingCode(null);
    setCodeForm({
      code: '',
      discountType: 'FLAT',
      value: '',
      minOrderValue: '0',
      maxDiscount: '',
      startDate: '',
      endDate: '',
      startTime: '',
      endTime: '',
      daysOfWeek: 'ALL',
    });
    setIsCodeModalOpen(true);
  };

  const openEditCodeModal = (code: PromoCodeItem) => {
    setEditingCode(code);
    setCodeForm({
      code: code.code,
      discountType: code.discountType,
      value: String(code.value),
      minOrderValue: String(code.minOrderValue),
      maxDiscount: code.maxDiscount ? String(code.maxDiscount) : '',
      startDate: code.startDate ? code.startDate.split('T')[0] : '',
      endDate: code.endDate ? code.endDate.split('T')[0] : '',
      startTime: code.startTime || '',
      endTime: code.endTime || '',
      daysOfWeek: code.daysOfWeek || 'ALL',
    });
    setIsCodeModalOpen(true);
  };

  const handleSaveCode = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const action = editingCode ? 'UPDATE_PROMO_CODE' : 'CREATE_PROMO_CODE';
      const res = await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          promoCode: {
            ...(editingCode && { id: editingCode.id }),
            ...codeForm,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        playSuccessChime();
        setIsCodeModalOpen(false);
        fetchPromos();
        // If a code was just created or updated, auto-select it in cardForm
        if (data.data?.id) {
          setCardForm((prev) => ({ ...prev, promoCodeId: data.data.id }));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleCode = async (code: PromoCodeItem) => {
    try {
      await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TOGGLE_CODE',
          promoCode: { id: code.id, isActive: !code.isActive },
        }),
      });
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Delete this promo code?')) return;
    try {
      await fetch('/api/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DELETE_PROMO_CODE',
          promoCode: { id },
        }),
      });
      fetchPromos();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Executive Header */}
      <header className="h-16 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-wider">
              THOOGUDEEPA DONNE BIRYANI
            </h1>
            <p className="text-[11px] text-purple-400 font-medium">Offers, Happy Hours & Promos Scheduler</p>
          </div>
        </div>

        {/* 9 Manager Portal Navigation Links */}
        <nav className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 text-xs font-bold">
          <Link href="/manager/floor" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Live Floor
          </Link>
          <Link href="/manager/kitchen" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Kitchen Oversight
          </Link>
          <Link href="/manager/menu" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Menu Items
          </Link>
          <Link href="/manager/qrs" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            QR Stands
          </Link>
          <Link href="/manager/shift" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Shift Audit
          </Link>
          <Link href="/manager/parcel" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Parcel Desk
          </Link>
          <Link href="/manager/reports" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Reports
          </Link>
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl bg-purple-500 text-white shadow-sm">
            Offers & Promos
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={openNewCodeModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Promo Code</span>
          </button>
          <button
            onClick={openNewCardModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Promo Card</span>
          </button>
          <Link
            href="/manager"
            className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition"
            title="Lock Portal"
          >
            <LogOut className="w-5 h-5" />
          </Link>
        </div>
      </header>

      {/* Tabs Bar */}
      <div className="h-14 bg-slate-900/50 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('CARDS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === 'CARDS'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Customer Menu Promotional Cards ({promoCards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CODES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === 'CODES'
                ? 'bg-purple-600 text-white shadow-md'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Tag className="w-4 h-4" />
            <span>Promo Codes & Happy Hours ({promoCodes.length})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Configure start/end dates, hourly happy hours & recurring days
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 p-6 overflow-y-auto">
        {activeTab === 'CARDS' ? (
          /* Cards Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promoCards.map((card) => (
              <div
                key={card.id}
                className={`bg-slate-900 rounded-3xl border p-5 flex flex-col justify-between transition shadow-lg relative overflow-hidden ${
                  card.isActive ? 'border-amber-500/30' : 'border-slate-800 opacity-60'
                }`}
              >
                {/* Top Gold Gradient Banner */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 to-amber-300" />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      {card.badgeText || 'SPECIAL OFFER'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCard(card)}
                        className="p-1 text-slate-400 hover:text-white"
                        title={card.isActive ? 'Disable card' : 'Enable card'}
                      >
                        {card.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditCardModal(card)}
                        className="p-1.5 text-slate-400 hover:text-amber-400 rounded-lg hover:bg-slate-800 transition"
                        title="Edit promo card"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                        title="Delete card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-white mb-1.5 leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{card.subtitle}</p>

                  {/* Promo Code Attached */}
                  {card.promoCode && (
                    <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-amber-400" />
                        <span className="text-xs font-mono font-bold text-white">
                          Use Code: {card.promoCode.code}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-400">
                        {card.promoCode.discountType === 'FLAT'
                          ? `₹${card.promoCode.value} OFF`
                          : `${card.promoCode.value}% OFF`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Scheduling Constraints */}
                <div className="pt-3 border-t border-slate-800 space-y-1.5 text-[11px] text-slate-400">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-purple-400" />
                    <span>
                      {card.startDate ? new Date(card.startDate).toLocaleDateString() : 'Always Active'}
                      {card.endDate ? ` ➔ ${new Date(card.endDate).toLocaleDateString()}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {card.startTime && card.endTime
                        ? `${card.startTime} - ${card.endTime} (Happy Hours)`
                        : 'All Day'}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-slate-500">
                    Days: <span className="text-slate-300">{card.daysOfWeek || 'ALL'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Codes Tab */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {promoCodes.map((code) => (
              <div
                key={code.id}
                className={`bg-slate-900 rounded-3xl border p-5 flex flex-col justify-between transition shadow-lg ${
                  code.isActive ? 'border-purple-500/30' : 'border-slate-800 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-purple-500/20 text-purple-300 font-mono font-black text-sm border border-purple-500/40">
                        {code.code}
                      </span>
                      <span className="text-xs font-bold text-emerald-400">
                        {code.discountType === 'FLAT' ? `₹${code.value} Flat OFF` : `${code.value}% Discount`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCode(code)}
                        className="p-1 text-slate-400 hover:text-white"
                        title={code.isActive ? 'Disable code' : 'Enable code'}
                      >
                        {code.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-400" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-slate-600" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditCodeModal(code)}
                        className="p-1.5 text-slate-400 hover:text-purple-400 rounded-lg hover:bg-slate-800 transition"
                        title="Edit promo code"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                        title="Delete code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300 my-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Min Order Required:</span>
                      <span className="font-bold text-white">₹{code.minOrderValue}</span>
                    </div>
                    {code.maxDiscount && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Max Discount Cap:</span>
                        <span className="font-bold text-amber-400">₹{code.maxDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Times Redeemed:</span>
                      <span className="font-bold text-purple-400">{code.timesUsed} orders</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-1 text-[11px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>
                      {code.startTime && code.endTime
                        ? `${code.startTime} - ${code.endTime} Slot`
                        : 'Any Time'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-500">
                    Days: <span className="text-slate-300">{code.daysOfWeek || 'ALL'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Design Promo Card Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-amber-400 text-sm">
                  {editingCard ? 'Edit Promotional Menu Card' : 'Design Promotional Menu Card'}
                </h3>
                <p className="text-xs text-slate-400">
                  Appears in customer swipable hero carousel above menu
                </p>
              </div>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Headline Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Donne Mutton Feast Combo"
                  value={cardForm.title}
                  onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Subtitle / Details *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 Donne Mutton Biryani + Chilli Chicken @ ₹399"
                  value={cardForm.subtitle}
                  onChange={(e) => setCardForm({ ...cardForm, subtitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Badge Text</label>
                  <input
                    type="text"
                    placeholder="SPECIAL OFFER"
                    value={cardForm.badgeText}
                    onChange={(e) => setCardForm({ ...cardForm, badgeText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-300">Attached Promo Code</label>
                    <div className="flex items-center gap-1.5">
                      {cardForm.promoCodeId && (
                        <button
                          type="button"
                          onClick={() => {
                            const codeToEdit = promoCodes.find((c) => c.id === cardForm.promoCodeId);
                            if (codeToEdit) openEditCodeModal(codeToEdit);
                          }}
                          className="text-[10px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 bg-purple-500/20 px-2 py-0.5 rounded border border-purple-500/30 transition hover:bg-purple-500/30"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openNewCodeModal}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition hover:bg-amber-500/30"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Add</span>
                      </button>
                    </div>
                  </div>
                  <select
                    value={cardForm.promoCodeId}
                    onChange={(e) => setCardForm({ ...cardForm, promoCodeId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="">None (Display only)</option>
                    {promoCodes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} ({c.discountType === 'FLAT' ? `₹${c.value}` : `${c.value}%`} off)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Time Happy Hours Scheduling */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-black uppercase text-purple-400 tracking-wider">
                  Scheduling & Happy Hours
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={cardForm.startDate}
                      onChange={(e) => setCardForm({ ...cardForm, startDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={cardForm.endDate}
                      onChange={(e) => setCardForm({ ...cardForm, endDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Start Time (HH:MM)</label>
                    <input
                      type="time"
                      value={cardForm.startTime}
                      onChange={(e) => setCardForm({ ...cardForm, startTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">End Time (HH:MM)</label>
                    <input
                      type="time"
                      value={cardForm.endTime}
                      onChange={(e) => setCardForm({ ...cardForm, endTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Active Days (Leave ALL for everyday)
                  </label>
                  <input
                    type="text"
                    placeholder="ALL or SAT,SUN or MON,TUE"
                    value={cardForm.daysOfWeek}
                    onChange={(e) => setCardForm({ ...cardForm, daysOfWeek: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs shadow-md"
                >
                  {editingCard ? 'Update Promo Card' : 'Save Promo Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create / Edit Promo Code Modal */}
      {isCodeModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-purple-400 text-sm">
                  {editingCode ? `Edit Promo Code: ${editingCode.code}` : 'Create Promo Code'}
                </h3>
                <p className="text-xs text-slate-400">
                  Customers enter this code in cart / waiter billing
                </p>
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCode} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Promo Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMBO399"
                  value={codeForm.code}
                  onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Discount Type *</label>
                  <select
                    value={codeForm.discountType}
                    onChange={(e) =>
                      setCodeForm({ ...codeForm, discountType: e.target.value as 'FLAT' | 'PERCENTAGE' })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  >
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Value {codeForm.discountType === 'FLAT' ? '(₹)' : '(%)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="50"
                    value={codeForm.value}
                    onChange={(e) => setCodeForm({ ...codeForm, value: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="399"
                    value={codeForm.minOrderValue}
                    onChange={(e) => setCodeForm({ ...codeForm, minOrderValue: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100 (Optional for %)"
                    value={codeForm.maxDiscount}
                    onChange={(e) => setCodeForm({ ...codeForm, maxDiscount: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              {/* Date & Time Restrictions */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-black uppercase text-purple-400 tracking-wider">
                  Validity & Day Restrictions
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={codeForm.startDate}
                      onChange={(e) => setCodeForm({ ...codeForm, startDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={codeForm.endDate}
                      onChange={(e) => setCodeForm({ ...codeForm, endDate: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Happy Hour From</label>
                    <input
                      type="time"
                      value={codeForm.startTime}
                      onChange={(e) => setCodeForm({ ...codeForm, startTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-0.5">Happy Hour To</label>
                    <input
                      type="time"
                      value={codeForm.endTime}
                      onChange={(e) => setCodeForm({ ...codeForm, endTime: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Allowed Days (ALL or MON,WED,FRI)
                  </label>
                  <input
                    type="text"
                    placeholder="ALL"
                    value={codeForm.daysOfWeek}
                    onChange={(e) => setCodeForm({ ...codeForm, daysOfWeek: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl text-xs shadow-md"
                >
                  {editingCode ? 'Update Promo Code' : 'Save Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

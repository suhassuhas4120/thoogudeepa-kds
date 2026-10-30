'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
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
  Sliders
} from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import ManagerTopNav from '@/components/ManagerTopNav';

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
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
      {/* Executive Unified Navigation Bar */}
      <ManagerTopNav
        activeTab="promos"
        extraRightActions={
          <div className="flex items-center gap-2">
            <button
              onClick={openNewCodeModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Promo Code</span>
            </button>
            <button
              onClick={openNewCardModal}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#D08A52] hover:bg-[#B8733D] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Promo Card</span>
            </button>
          </div>
        }
      />

      {/* Tabs Bar */}
      <div className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab('CARDS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === 'CARDS'
                ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#8A4228]" />
            <span>Customer Menu Promotional Cards ({promoCards.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('CODES')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition ${
              activeTab === 'CODES'
                ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Tag className="w-4 h-4 text-[#8A4228]" />
            <span>Promo Codes & Happy Hours ({promoCodes.length})</span>
          </button>
        </div>

        <div className="text-xs text-stone-500 font-medium">
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
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition shadow-xs relative overflow-hidden ${
                  card.isActive ? 'border-[#8A4228]/40' : 'border-stone-200 opacity-60'
                }`}
              >
                {/* Top Gold Gradient Banner */}
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#8A4228] via-[#D08A52] to-[#8A4228]" />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#8A4228]/10 text-[#8A4228] border border-[#8A4228]/20">
                      {card.badgeText || 'SPECIAL OFFER'}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCard(card)}
                        className="p-1 text-stone-500 hover:text-stone-900"
                        title={card.isActive ? 'Disable card' : 'Enable card'}
                      >
                        {card.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-700" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-stone-600" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditCardModal(card)}
                        className="p-1.5 text-stone-500 hover:text-[#8A4228] rounded-lg hover:bg-stone-100 transition"
                        title="Edit promo card"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg hover:bg-stone-100 transition"
                        title="Delete card"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base font-black text-stone-900 mb-1.5 leading-snug">
                    {card.title}
                  </h3>
                  <p className="text-xs text-stone-500 leading-relaxed mb-4">{card.subtitle}</p>

                  {/* Promo Code Attached */}
                  {card.promoCode && (
                    <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[#8A4228]" />
                        <span className="text-xs font-mono font-bold text-stone-900">
                          Use Code: {card.promoCode.code}
                        </span>
                      </div>
                      <span className="text-[11px] font-bold text-emerald-700">
                        {card.promoCode.discountType === 'FLAT'
                          ? `₹${card.promoCode.value} OFF`
                          : `${card.promoCode.value}% OFF`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Scheduling Constraints */}
                <div className="pt-3 border-t border-stone-200 space-y-1.5 text-[11px] text-stone-500">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-[#8A4228]" />
                    <span>
                      {card.startDate ? new Date(card.startDate).toLocaleDateString() : 'Always Active'}
                      {card.endDate ? ` ➔ ${new Date(card.endDate).toLocaleDateString()}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#8A4228]" />
                    <span>
                      {card.startTime && card.endTime
                        ? `${card.startTime} - ${card.endTime} (Happy Hours)`
                        : 'All Day'}
                    </span>
                  </div>

                  <div className="text-[10px] font-mono text-stone-500">
                    Days: <span className="text-stone-700">{card.daysOfWeek || 'ALL'}</span>
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
                className={`bg-white rounded-2xl border p-5 flex flex-col justify-between transition shadow-xs ${
                  code.isActive ? 'border-[#8A4228]/40' : 'border-stone-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-[#8A4228]/10 text-[#8A4228] font-mono font-black text-sm border border-[#8A4228]/20">
                        {code.code}
                      </span>
                      <span className="text-xs font-bold text-emerald-700">
                        {code.discountType === 'FLAT' ? `₹${code.value} Flat OFF` : `${code.value}% Discount`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleToggleCode(code)}
                        className="p-1 text-stone-500 hover:text-stone-900"
                        title={code.isActive ? 'Disable code' : 'Enable code'}
                      >
                        {code.isActive ? (
                          <ToggleRight className="w-6 h-6 text-emerald-700" />
                        ) : (
                          <ToggleLeft className="w-6 h-6 text-stone-600" />
                        )}
                      </button>
                      <button
                        onClick={() => openEditCodeModal(code)}
                        className="p-1.5 text-stone-500 hover:text-[#8A4228] rounded-lg hover:bg-stone-100 transition"
                        title="Edit promo code"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCode(code.id)}
                        className="p-1.5 text-stone-500 hover:text-rose-400 rounded-lg hover:bg-stone-100 transition"
                        title="Delete code"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-stone-700 my-3">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Min Order Required:</span>
                      <span className="font-bold text-stone-900">₹{code.minOrderValue}</span>
                    </div>
                    {code.maxDiscount && (
                      <div className="flex justify-between">
                        <span className="text-stone-500">Max Discount Cap:</span>
                        <span className="font-bold text-[#8A4228]">₹{code.maxDiscount}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-stone-500">Times Redeemed:</span>
                      <span className="font-bold text-[#8A4228]">{code.timesUsed} orders</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-stone-200 space-y-1 text-[11px] text-stone-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#8A4228]" />
                    <span>
                      {code.startTime && code.endTime
                        ? `${code.startTime} - ${code.endTime} Slot`
                        : 'Any Time'}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-stone-500">
                    Days: <span className="text-stone-700">{code.daysOfWeek || 'ALL'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Design Promo Card Modal */}
      {isCardModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#8A4228] text-sm">
                  {editingCard ? 'Edit Promotional Menu Card' : 'Design Promotional Menu Card'}
                </h3>
                <p className="text-xs text-stone-500">
                  Appears in customer swipable hero carousel above menu
                </p>
              </div>
              <button
                onClick={() => setIsCardModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Headline Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Weekend Donne Mutton Feast Combo"
                  value={cardForm.title}
                  onChange={(e) => setCardForm({ ...cardForm, title: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 placeholder-stone-600 focus:outline-none focus:border-[#D08A52]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Subtitle / Details *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 Donne Mutton Biryani + Chilli Chicken @ ₹399"
                  value={cardForm.subtitle}
                  onChange={(e) => setCardForm({ ...cardForm, subtitle: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 placeholder-stone-600 focus:outline-none focus:border-[#D08A52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Badge Text</label>
                  <input
                    type="text"
                    placeholder="SPECIAL OFFER"
                    value={cardForm.badgeText}
                    onChange={(e) => setCardForm({ ...cardForm, badgeText: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 placeholder-stone-600 focus:outline-none focus:border-[#D08A52]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-stone-700">Attached Promo Code</label>
                    <div className="flex items-center gap-1.5">
                      {cardForm.promoCodeId && (
                        <button
                          type="button"
                          onClick={() => {
                            const codeToEdit = promoCodes.find((c) => c.id === cardForm.promoCodeId);
                            if (codeToEdit) openEditCodeModal(codeToEdit);
                          }}
                          className="text-[10px] font-bold text-[#8A4228] hover:text-amber-300 flex items-center gap-1 bg-[#8A4228]/20 px-2 py-0.5 rounded border border-[#8A4228]/30 transition hover:bg-[#8A4228]/30"
                        >
                          <Edit className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openNewCodeModal}
                        className="text-[10px] font-bold text-[#8A4228] hover:text-amber-300 flex items-center gap-1 bg-[#8A4228]/20 px-2 py-0.5 rounded border border-[#8A4228]/30 transition hover:bg-[#8A4228]/30"
                      >
                        <Plus className="w-3 h-3" />
                        <span>+ Add</span>
                      </button>
                    </div>
                  </div>
                  <select
                    value={cardForm.promoCodeId}
                    onChange={(e) => setCardForm({ ...cardForm, promoCodeId: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
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
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-black uppercase text-[#8A4228] tracking-wider">
                  Scheduling & Happy Hours
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={cardForm.startDate}
                      onChange={(e) => setCardForm({ ...cardForm, startDate: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={cardForm.endDate}
                      onChange={(e) => setCardForm({ ...cardForm, endDate: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">Start Time (HH:MM)</label>
                    <input
                      type="time"
                      value={cardForm.startTime}
                      onChange={(e) => setCardForm({ ...cardForm, startTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">End Time (HH:MM)</label>
                    <input
                      type="time"
                      value={cardForm.endTime}
                      onChange={(e) => setCardForm({ ...cardForm, endTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-stone-500 mb-1">
                    Active Days (Leave ALL for everyday)
                  </label>
                  <input
                    type="text"
                    placeholder="ALL or SAT,SUN or MON,TUE"
                    value={cardForm.daysOfWeek}
                    onChange={(e) => setCardForm({ ...cardForm, daysOfWeek: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900 font-mono focus:outline-none focus:border-[#D08A52]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCardModalOpen(false)}
                  className="px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold rounded-xl text-xs shadow-xs transition"
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
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-[#8A4228] text-sm">
                  {editingCode ? `Edit Promo Code: ${editingCode.code}` : 'Create Promo Code'}
                </h3>
                <p className="text-xs text-stone-500">
                  Customers enter this code in cart / waiter billing
                </p>
              </div>
              <button
                onClick={() => setIsCodeModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCode} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Promo Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. COMBO399"
                  value={codeForm.code}
                  onChange={(e) => setCodeForm({ ...codeForm, code: e.target.value.toUpperCase() })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 font-mono uppercase focus:outline-none focus:border-[#D08A52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Discount Type *</label>
                  <select
                    value={codeForm.discountType}
                    onChange={(e) =>
                      setCodeForm({ ...codeForm, discountType: e.target.value as 'FLAT' | 'PERCENTAGE' })
                    }
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                  >
                    <option value="FLAT">Flat Amount (₹)</option>
                    <option value="PERCENTAGE">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Value {codeForm.discountType === 'FLAT' ? '(₹)' : '(%)'} *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="50"
                    value={codeForm.value}
                    onChange={(e) => setCodeForm({ ...codeForm, value: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Min Order Value (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="399"
                    value={codeForm.minOrderValue}
                    onChange={(e) => setCodeForm({ ...codeForm, minOrderValue: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Max Cap (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="100 (Optional for %)"
                    value={codeForm.maxDiscount}
                    onChange={(e) => setCodeForm({ ...codeForm, maxDiscount: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                  />
                </div>
              </div>

              {/* Date & Time Restrictions */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
                <div className="text-[11px] font-black uppercase text-[#8A4228] tracking-wider">
                  Validity & Day Restrictions
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">Start Date</label>
                    <input
                      type="date"
                      value={codeForm.startDate}
                      onChange={(e) => setCodeForm({ ...codeForm, startDate: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">End Date</label>
                    <input
                      type="date"
                      value={codeForm.endDate}
                      onChange={(e) => setCodeForm({ ...codeForm, endDate: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">Happy Hour From</label>
                    <input
                      type="time"
                      value={codeForm.startTime}
                      onChange={(e) => setCodeForm({ ...codeForm, startTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-stone-500 mb-0.5">Happy Hour To</label>
                    <input
                      type="time"
                      value={codeForm.endTime}
                      onChange={(e) => setCodeForm({ ...codeForm, endTime: e.target.value })}
                      className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-stone-900 focus:outline-none focus:border-[#D08A52]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-stone-500 mb-1">
                    Allowed Days (ALL or MON,WED,FRI)
                  </label>
                  <input
                    type="text"
                    placeholder="ALL"
                    value={codeForm.daysOfWeek}
                    onChange={(e) => setCodeForm({ ...codeForm, daysOfWeek: e.target.value.toUpperCase() })}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs text-stone-900 font-mono focus:outline-none focus:border-[#D08A52]"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCodeModalOpen(false)}
                  className="px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold rounded-xl text-xs shadow-xs transition"
                >
                  {editingCode ? 'Update Promo Code' : 'Save Promo Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

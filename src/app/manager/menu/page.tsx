'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  UtensilsCrossed
} from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';
import ManagerTopNav from '@/components/ManagerTopNav';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface MenuItem {
  id: string;
  name: string;
  categoryId: string;
  category?: Category;
  description?: string;
  price: number;
  isVeg: boolean;
  isAvailable: boolean;
  isPairWith: boolean;
  imageUrl?: string;
  displayOrder: number;
}

export default function ManagerMenuScreen() {
  const socket = useSocketRoom('room:manager');
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    categoryId: '',
    price: '',
    description: '',
    isVeg: false,
    isPairWith: false,
    imageUrl: '',
    displayOrder: 0,
  });

  const fetchMenu = async () => {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data.categories);
        setItems(data.data.items);
      }
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handleUpdate = () => fetchMenu();
    socket.on('menu:updated', handleUpdate);
    socket.on('menu:item_86_toggled', handleUpdate);
    return () => {
      socket.off('menu:updated', handleUpdate);
      socket.off('menu:item_86_toggled', handleUpdate);
    };
  }, [socket]);

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      categoryId: categories[0]?.id || '',
      price: '',
      description: '',
      isVeg: false,
      isPairWith: false,
      imageUrl: '',
      displayOrder: items.length + 1,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      categoryId: item.categoryId,
      price: item.price.toString(),
      description: item.description || '',
      isVeg: item.isVeg,
      isPairWith: item.isPairWith,
      imageUrl: item.imageUrl || '',
      displayOrder: item.displayOrder,
    });
    setIsModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        // Update
        const res = await fetch('/api/menu', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingItem.id,
            ...formData,
          }),
        });
        const data = await res.json();
        if (data.success) {
          playSuccessChime();
          setIsModalOpen(false);
          fetchMenu();
        }
      } else {
        // Create
        const res = await fetch('/api/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (data.success) {
          playSuccessChime();
          setIsModalOpen(false);
          fetchMenu();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleTogglePairWith = async (item: MenuItem) => {
    try {
      await fetch('/api/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          isPairWith: !item.isPairWith,
        }),
      });
      fetchMenu();
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleAvailable = async (item: MenuItem) => {
    try {
      await fetch('/api/kitchen/toggle-86', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: item.id,
          isAvailable: !item.isAvailable,
        }),
      });
      fetchMenu();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to remove this dish from the active menu?')) return;
    try {
      const res = await fetch(`/api/menu?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchMenu();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.categoryId === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category?.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#FBF9F6] text-stone-900 flex flex-col font-sans select-none p-3">
      <div className="border border-[#8A4228] rounded-2xl bg-[#FBF9F6] min-h-[calc(100vh-1.5rem)] flex flex-col overflow-hidden">
      {/* Executive Unified Navigation Bar */}
      <ManagerTopNav
        activeTab="menu"
        extraRightActions={
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#8A4228] hover:bg-[#71351F] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Dish</span>
          </button>
        }
      />

      {/* Filter and Search Bar */}
      <div className="h-14 bg-white border-b border-stone-200 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            All Categories ({items.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                selectedCategory === c.id
                  ? 'bg-[#8A4228] text-white shadow-xs font-bold'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search dish name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D08A52]"
          />
        </div>
      </div>

      {/* Menu Dishes Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-white rounded-2xl border p-4 flex flex-col justify-between transition hover:border-[#8A4228]/60 shadow-xs ${
                item.isAvailable ? 'border-stone-200' : 'border-rose-900/40 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        item.isVeg ? 'bg-emerald-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-[10px] font-black uppercase tracking-wider text-stone-500">
                      {item.category?.name || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePairWith(item)}
                      title={item.isPairWith ? 'Enabled in Cart "Pair With"' : 'Enable in Cart "Pair With"'}
                      className={`p-1.5 rounded-lg text-xs font-bold transition ${
                        item.isPairWith
                          ? 'bg-[#8A4228]/20 text-[#8A4228] border border-[#8A4228]/40'
                          : 'bg-stone-50 border border-stone-200 text-stone-500 hover:text-stone-700'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg bg-stone-50 border border-stone-200 text-stone-700 hover:text-stone-900"
                      title="Edit Dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg bg-stone-50 border border-stone-200 text-stone-500 hover:text-rose-400"
                      title="Delete / Disable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-stone-900 text-base leading-tight mb-1">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-stone-500 line-clamp-2 mb-3">{item.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-[#8A4228]">₹{item.price}</span>
                  <span className="text-[10px] text-stone-500 ml-1">+ 5% GST</span>
                </div>

                <button
                  onClick={() => handleToggleAvailable(item)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    item.isAvailable
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}
                >
                  {item.isAvailable ? 'Available' : 'Sold Out (86)'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Dish Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-stone-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="font-black text-stone-900 text-base">
                  {editingItem ? 'Edit Dish' : 'Add New Menu Dish'}
                </h3>
                <p className="text-xs text-stone-500">Updates sync instantly to all QR menus & KDS</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-500 hover:text-stone-900 flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Donne Mutton Biryani"
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D08A52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-[#D08A52]"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="290"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D08A52]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Seeraga Samba rice cooked in copper handi with spices..."
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:border-[#D08A52]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVeg}
                    onChange={(e) => setFormData({ ...formData, isVeg: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Vegetarian Dish</span>
                    <span className="text-[10px] text-stone-500">Green mark on menu</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 bg-stone-50 border border-stone-200 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPairWith}
                    onChange={(e) => setFormData({ ...formData, isPairWith: e.target.checked })}
                    className="w-4 h-4 accent-[#D08A52] rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">Pair With Add-On</span>
                    <span className="text-[10px] text-stone-500">Featured in cart slider</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-stone-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8A4228] hover:bg-[#71351F] text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  {editingItem ? 'Save Changes' : 'Create Dish'}
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

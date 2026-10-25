'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  LogOut,
  UtensilsCrossed
} from 'lucide-react';
import { useSocketRoom } from '@/lib/useSocket';
import { playSuccessChime } from '@/lib/audio-synth';

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
            <p className="text-[11px] text-purple-400 font-medium">Menu Catalog & Dish Engine</p>
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
          <Link href="/manager/menu" className="px-3 py-1.5 rounded-xl bg-purple-500 text-white shadow-sm">
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
          <Link href="/manager/promos" className="px-3 py-1.5 rounded-xl text-slate-400 hover:text-white">
            Offers & Promos
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Dish</span>
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

      {/* Filter and Search Bar */}
      <div className="h-14 bg-slate-900/50 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 overflow-x-auto py-1">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              selectedCategory === 'ALL'
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
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
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="relative w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search dish name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Menu Dishes Grid */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className={`bg-slate-900 rounded-2xl border p-4 flex flex-col justify-between transition hover:border-purple-500/40 shadow-sm ${
                item.isAvailable ? 'border-slate-800' : 'border-red-500/30 opacity-75'
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
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      {item.category?.name || 'General'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleTogglePairWith(item)}
                      title={item.isPairWith ? 'Enabled in Cart "Pair With"' : 'Enable in Cart "Pair With"'}
                      className={`p-1.5 rounded-lg text-xs font-bold transition ${
                        item.isPairWith
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                      title="Edit Dish"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-red-400"
                      title="Delete / Disable"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <h3 className="font-black text-white text-base leading-tight mb-1">{item.name}</h3>
                {item.description && (
                  <p className="text-xs text-slate-400 line-clamp-2 mb-3">{item.description}</p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-lg font-black text-amber-400">₹{item.price}</span>
                  <span className="text-[10px] text-slate-400 ml-1">+ 5% GST</span>
                </div>

                <button
                  onClick={() => handleToggleAvailable(item)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                    item.isAvailable
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/20 text-red-400 border border-red-500/30'
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-black text-white text-base">
                  {editingItem ? 'Edit Dish' : 'Add New Menu Dish'}
                </h3>
                <p className="text-xs text-slate-400">Updates sync instantly to all QR menus & KDS</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Dish Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Donne Mutton Biryani"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Category *</label>
                  <select
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    step="1"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="290"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Seeraga Samba rice cooked in copper handi with spices..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <label className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isVeg}
                    onChange={(e) => setFormData({ ...formData, isVeg: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Vegetarian Dish</span>
                    <span className="text-[10px] text-slate-400">Green mark on menu</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-3 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPairWith}
                    onChange={(e) => setFormData({ ...formData, isPairWith: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <div>
                    <span className="text-xs font-bold text-white block">Pair With Add-On</span>
                    <span className="text-[10px] text-slate-400">Featured in cart slider</span>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-md"
                >
                  {editingItem ? 'Save Changes' : 'Create Dish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

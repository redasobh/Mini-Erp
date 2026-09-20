import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getStockStatusBadge } from '../lib/utils';
import { Search, Boxes, AlertTriangle, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import type { Product, Category } from '../types/app';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all');

  const loadInventory = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').order('stock_quantity', { ascending: true }),
        supabase.from('categories').select('*'),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Error loading inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (statusFilter === 'out') return p.stock_quantity <= 0;
    if (statusFilter === 'low') return p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level;
    return true;
  });

  const outOfStockCount = products.filter((p) => p.stock_quantity <= 0).length;
  const lowStockCount = products.filter(
    (p) => p.stock_quantity > 0 && p.stock_quantity <= p.min_stock_level
  ).length;
  const inStockCount = products.length - outOfStockCount - lowStockCount;

  return (
    <div className="space-y-6">
      {/* Inventory KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div
          onClick={() => setStatusFilter('all')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'all'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md'
              : 'bg-white text-slate-800 border-slate-100 shadow-sm hover:border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold opacity-80">إجمالي الأصناف المتابعة</span>
            <Boxes className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-black font-mono">{products.length}</p>
        </div>

        <div
          onClick={() => setStatusFilter('low')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'low'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white text-slate-800 border-slate-100 shadow-sm hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold opacity-80">أصناف قاربت على النفاد</span>
            <AlertTriangle className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-black font-mono text-amber-500">{lowStockCount}</p>
        </div>

        <div
          onClick={() => setStatusFilter('out')}
          className={`p-5 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === 'out'
              ? 'bg-rose-600 text-white border-rose-600 shadow-md'
              : 'bg-white text-slate-800 border-slate-100 shadow-sm hover:border-rose-200'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold opacity-80">أصناف نفدت بالكامل</span>
            <AlertCircle className="w-5 h-5 opacity-70" />
          </div>
          <p className="text-2xl font-black font-mono text-rose-500">{outOfStockCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن صنف في المخزن..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        <button
          onClick={loadInventory}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث الأرصدة</span>
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner message="جاري فحص أرصدة المخزون..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="لا توجد بيانات مطابقة"
            description="لم يتم العثور على أي منتج يطابق الفلتر المحدد."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="py-3.5 px-6 font-bold">اسم المنتج</th>
                  <th className="py-3.5 px-6 font-bold">التصنيف</th>
                  <th className="py-3.5 px-6 font-bold text-center">الرصيد الفعلي</th>
                  <th className="py-3.5 px-6 font-bold text-center">الحد الأدنى للتنبيه</th>
                  <th className="py-3.5 px-6 font-bold text-center">حالة المخزون</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((prod) => {
                  const categoryName = categories.find((c) => c.id === prod.category_id)?.name || '-';
                  const status = getStockStatusBadge(prod.stock_quantity, prod.min_stock_level);

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{prod.name}</td>
                      <td className="py-4 px-6 text-xs text-slate-500">{categoryName}</td>
                      <td className="py-4 px-6 text-center font-mono font-black text-sm">
                        {prod.stock_quantity}
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-xs text-slate-400">
                        {prod.min_stock_level}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

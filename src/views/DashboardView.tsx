import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency, formatDateTime, getSaleStatusBadge } from '../lib/utils';
import { DollarSign, ShoppingBag, AlertTriangle, ArrowUpRight, ShoppingCart, UtensilsCrossed, Receipt } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import type { Sale, Product, ViewType } from '../types/app';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todayOrdersCount, setTodayOrdersCount] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Calculate today range (start of today in local timezone)
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      // 2. Fetch today sales
      const { data: todaySales, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', startOfToday);

      if (!salesErr && todaySales) {
        setTodayOrdersCount(todaySales.length);
        const total = todaySales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        setTodaySalesTotal(total);
      }

      // 3. Fetch recent sales (last 5)
      const { data: recent, error: recentErr } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!recentErr && recent) {
        setRecentSales(recent);
      }

      // 4. Fetch low stock products
      const { data: products, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true);

      if (!prodErr && products) {
        const lowStock = products.filter((p) => p.stock_quantity <= p.min_stock_level);
        setLowStockProducts(lowStock);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return <LoadingSpinner message="جاري تجهيز بيانات لوحة المؤشرات..." />;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-emerald-700 to-emerald-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-950/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black mb-1">مرحباً بك في نظام إدارة المطعم</h2>
          <p className="text-emerald-100 text-sm">متابعة فورية للمبيعات اليومية، المخزون، ونقاط البيع.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 py-3 px-5 rounded-2xl bg-white text-emerald-900 hover:bg-emerald-50 text-sm font-bold transition-all shadow-md"
          >
            <ShoppingCart className="w-4 h-4 text-emerald-600" />
            <span>فتح شاشة البيع (POS)</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Today's Sales */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">مبيعات اليوم</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(todaySalesTotal)}</p>
          </div>
        </div>

        {/* Today's Invoices */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">فواتير اليوم</p>
            <p className="text-2xl font-black text-slate-900">{todayOrdersCount} <span className="text-xs font-normal text-slate-400">فاتورة</span></p>
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 mb-1">تنبيهات المخزون</p>
            <p className="text-2xl font-black text-slate-900">
              {lowStockProducts.length} <span className="text-xs font-normal text-slate-400">منتجات منخفضة</span>
            </p>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Sales & Low Stock List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Invoices */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-emerald-600" />
              <span>آخر الفواتير الصادرة</span>
            </h3>
            <button
              onClick={() => onNavigate('sales')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <span>عرض الكل</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentSales.length === 0 ? (
            <EmptyState title="لا توجد فواتير مسجلة اليوم" description="ابدأ بإصدار أول فاتورة بيع من شاشة الـ POS." />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentSales.map((sale) => {
                const badge = getSaleStatusBadge(sale.status);
                return (
                  <div key={sale.id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="font-mono font-bold text-sm text-slate-900">{sale.invoice_number}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(sale.created_at)}</p>
                    </div>
                    <div className="text-left flex items-center gap-3">
                      <span className="font-bold text-sm text-slate-800">{formatCurrency(sale.total_amount)}</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>منتجات قاربت على النفاد</span>
            </h3>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
            >
              <span>متابعة المخزون</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <EmptyState title="المخزون في حالة ممتازة" description="لا توجد أصناف وصلت إلى الحد الأدنى حالياً." />
          ) : (
            <div className="divide-y divide-slate-100">
              {lowStockProducts.slice(0, 5).map((prod) => (
                <div key={prod.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs">
                      {prod.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-800">{prod.name}</p>
                      <p className="text-xs text-slate-400">الحد الأدنى: {prod.min_stock_level}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        prod.stock_quantity === 0
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {prod.stock_quantity === 0 ? 'نفد المخزون' : `متبقي: ${prod.stock_quantity}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

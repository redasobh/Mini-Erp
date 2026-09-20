import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency, getPaymentMethodLabel } from '../lib/utils';
import { BarChart3, Calendar, DollarSign, Receipt, Tag, CreditCard, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import type { Sale, Payment } from '../types/app';

type DateFilter = 'today' | 'yesterday' | 'week' | 'month';

export const ReportsView: React.FC = () => {
  const [filter, setFilter] = useState<DateFilter>('today');
  const [loading, setLoading] = useState(true);

  // Aggregated data
  const [salesCount, setSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalDiscount, setTotalDiscount] = useState(0);
  const [paymentsByMethod, setPaymentsByMethod] = useState<Record<string, number>>({});

  const getDateRange = (filterType: DateFilter): { start: string; end: string } => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (filterType === 'today') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (filterType === 'yesterday') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);
      end.setDate(now.getDate() - 1);
      end.setHours(23, 59, 59, 999);
    } else if (filterType === 'week') {
      // 7 days ago
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
    } else if (filterType === 'month') {
      // 30 days ago
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  };

  const loadReportData = async () => {
    setLoading(true);
    const { start, end } = getDateRange(filter);

    try {
      // 1. Query sales within date range
      const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', start)
        .lte('created_at', end);

      if (!salesErr && sales) {
        setSalesCount(sales.length);
        const revenue = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
        const discount = sales.reduce((acc, s) => acc + Number(s.discount_amount || 0), 0);
        setTotalRevenue(revenue);
        setTotalDiscount(discount);

        // 2. Query payments for these sales
        const saleIds = sales.map((s) => s.id);
        if (saleIds.length > 0) {
          const { data: payments, error: payErr } = await supabase
            .from('payments')
            .select('*')
            .in('sale_id', saleIds);

          if (!payErr && payments) {
            const methodTotals: Record<string, number> = {};
            payments.forEach((p) => {
              const m = p.payment_method || 'CASH';
              methodTotals[m] = (methodTotals[m] || 0) + Number(p.amount || 0);
            });
            setPaymentsByMethod(methodTotals);
          }
        } else {
          setPaymentsByMethod({});
        }
      }
    } catch (err) {
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, [filter]);

  return (
    <div className="space-y-6">
      {/* Date Range Filter Bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'today', label: 'اليوم' },
            { id: 'yesterday', label: 'أمس' },
            { id: 'week', label: 'آخر 7 أيام' },
            { id: 'month', label: 'آخر 30 يوماً' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilter(item.id as DateFilter)}
              className={`py-2 px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                filter === item.id
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          onClick={loadReportData}
          className="flex items-center gap-2 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث التقرير</span>
        </button>
      </div>

      {loading ? (
        <LoadingSpinner message="جاري استخراج بيانات التقرير..." />
      ) : (
        <>
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Total Revenue */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">صافي المبيعات</p>
                <p className="text-2xl font-black text-slate-900 font-mono">
                  {formatCurrency(totalRevenue)}
                </p>
              </div>
            </div>

            {/* Invoices Count */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Receipt className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">عدد الفواتير الصادرة</p>
                <p className="text-2xl font-black text-slate-900 font-mono">
                  {salesCount} <span className="text-xs font-normal text-slate-400">فاتورة</span>
                </p>
              </div>
            </div>

            {/* Total Discounts */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <Tag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-1">إجمالي الخصومات</p>
                <p className="text-2xl font-black text-rose-600 font-mono">
                  {formatCurrency(totalDiscount)}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown by Payment Method */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
            <h3 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <span>المبيعات مصنفة حسب طريقة الدفع</span>
            </h3>

            {Object.keys(paymentsByMethod).length === 0 ? (
              <EmptyState title="لا توجد مبيعات في هذه الفترة" description="جرب اختيار فترة زمنية أخرى." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(paymentsByMethod).map(([method, amount]) => {
                  const percentage = totalRevenue > 0 ? ((amount / totalRevenue) * 100).toFixed(1) : 0;
                  return (
                    <div
                      key={method}
                      className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between"
                    >
                      <div>
                        <p className="text-xs text-slate-500 font-medium mb-1">
                          {getPaymentMethodLabel(method)}
                        </p>
                        <p className="text-lg font-black text-slate-900 font-mono">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                      <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600">
                        {percentage}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

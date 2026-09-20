import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { formatCurrency, formatDateTime, getSaleStatusBadge, getPaymentMethodLabel } from '../lib/utils';
import { Search, Receipt, Eye, Printer, RefreshCw } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { InvoiceModal } from '../components/invoice/InvoiceModal';
import type { Sale, SaleItem, Payment } from '../types/app';

export const SalesView: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected sale for invoice modal
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [selectedItems, setSelectedItems] = useState<Array<SaleItem & { product_name?: string }>>([]);
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([]);
  const [selectedCashier, setSelectedCashier] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const loadSales = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setSales(data);
      }
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales();
  }, []);

  const openInvoiceDetails = async (sale: Sale) => {
    setSelectedSale(sale);
    setLoadingDetails(true);
    setModalOpen(true);

    try {
      // Fetch items and payments for this sale
      const [itemsRes, paymentsRes, userRes] = await Promise.all([
        supabase
          .from('sale_items')
          .select(`
            *,
            products (
              name
            )
          `)
          .eq('sale_id', sale.id),
        supabase.from('payments').select('*').eq('sale_id', sale.id),
        supabase.from('users').select('full_name').eq('id', sale.user_id).single(),
      ]);

      if (itemsRes.data) {
        const formattedItems = itemsRes.data.map((item: any) => ({
          ...item,
          product_name: item.products?.name || 'منتج',
        }));
        setSelectedItems(formattedItems);
      }

      if (paymentsRes.data) {
        setSelectedPayments(paymentsRes.data);
      }

      if (userRes.data) {
        setSelectedCashier(userRes.data.full_name);
      }
    } catch (err) {
      console.error('Error fetching invoice details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const filteredSales = sales.filter((s) =>
    s.invoice_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم الفاتورة (مثال: INV-)..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        <button
          onClick={loadSales}
          className="flex items-center gap-2 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>تحديث السجل</span>
        </button>
      </div>

      {/* Sales Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner message="جاري تحميل سجل الفواتير..." />
        ) : filteredSales.length === 0 ? (
          <EmptyState
            title="لا توجد فواتير مطابقة"
            description="لم يتم العثور على أي فاتورة بيع تطابق البحث."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="py-3.5 px-6 font-bold">رقم الفاتورة</th>
                  <th className="py-3.5 px-6 font-bold">التاريخ والوقت</th>
                  <th className="py-3.5 px-6 font-bold text-center">الحالة</th>
                  <th className="py-3.5 px-6 font-bold text-left">المجموع الفرعي</th>
                  <th className="py-3.5 px-6 font-bold text-left">الخصم</th>
                  <th className="py-3.5 px-6 font-bold text-left">الإجمالي النهائي</th>
                  <th className="py-3.5 px-6 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSales.map((sale) => {
                  const badge = getSaleStatusBadge(sale.status);
                  return (
                    <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-mono font-bold text-slate-900">
                        {sale.invoice_number}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-500">
                        {formatDateTime(sale.created_at)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-left font-mono text-xs">
                        {formatCurrency(sale.subtotal)}
                      </td>
                      <td className="py-4 px-6 text-left font-mono text-xs text-rose-600">
                        {Number(sale.discount_amount) > 0 ? `-${formatCurrency(sale.discount_amount)}` : '-'}
                      </td>
                      <td className="py-4 px-6 text-left font-mono font-bold text-slate-900">
                        {formatCurrency(sale.total_amount)}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => openInvoiceDetails(sale)}
                          className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-bold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>عرض وطباعة</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Details Modal */}
      <InvoiceModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        sale={selectedSale}
        items={selectedItems}
        payments={selectedPayments}
        cashierName={selectedCashier}
      />
    </div>
  );
};

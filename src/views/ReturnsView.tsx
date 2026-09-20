import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency, formatDateTime, getPaymentMethodLabel, getSaleStatusBadge } from '../lib/utils';
import { Search, RotateCcw, Check, AlertCircle, Banknote, CreditCard, ArrowRightLeft, Wallet, FileCheck } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import type { Sale, SaleItem, PaymentMethod } from '../types/app';

interface ReturnCandidateItem {
  sale_item_id: string;
  product_id: string;
  product_name: string;
  sold_qty: number;
  previously_returned_qty: number;
  remaining_qty: number;
  unit_price: number;
  return_qty: number;
}

export const ReturnsView: React.FC = () => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState('');
  const [searching, setSearching] = useState(false);
  const [foundSale, setFoundSale] = useState<Sale | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnCandidateItem[]>([]);

  const [refundMethod, setRefundMethod] = useState<PaymentMethod>('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [submittingReturn, setSubmittingReturn] = useState(false);

  // Success modal
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastReturnResult, setLastReturnResult] = useState<{
    return_number: string;
    total_refund: number;
    method: string;
  } | null>(null);

  // Search invoice
  const handleSearchInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInvoiceNumber.trim()) {
      showToast('يرجى إدخال رقم الفاتورة', 'error');
      return;
    }

    setSearching(true);
    setFoundSale(null);
    setReturnItems([]);

    try {
      // 1. Fetch sale
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .select('*')
        .ilike('invoice_number', searchInvoiceNumber.trim())
        .single();

      if (saleErr || !saleData) {
        showToast('لم يتم العثور على فاتورة بهذا الرقم', 'error');
        setSearching(false);
        return;
      }

      if (saleData.status === 'CANCELLED') {
        showToast('هذه الفاتورة ملغاة ولا يمكن إجراء مرتجع عليها', 'error');
        setSearching(false);
        return;
      }

      if (saleData.status === 'RETURNED_FULL') {
        showToast('تم إرجاع هذه الفاتورة بالكامل مسبقاً', 'error');
        setSearching(false);
        return;
      }

      setFoundSale(saleData);

      // 2. Fetch sale items with previously returned quantities
      const { data: itemsData, error: itemsErr } = await supabase
        .from('sale_items')
        .select(`
          id,
          product_id,
          quantity,
          unit_price,
          products (
            name
          ),
          return_items (
            quantity
          )
        `)
        .eq('sale_id', saleData.id);

      if (!itemsErr && itemsData) {
        const candidates: ReturnCandidateItem[] = itemsData.map((item: any) => {
          const previouslyReturned = (item.return_items || []).reduce(
            (acc: number, ri: any) => acc + (Number(ri.quantity) || 0),
            0
          );
          const remaining = Math.max(item.quantity - previouslyReturned, 0);

          return {
            sale_item_id: item.id,
            product_id: item.product_id,
            product_name: item.products?.name || 'منتج',
            sold_qty: item.quantity,
            previously_returned_qty: previouslyReturned,
            remaining_qty: remaining,
            unit_price: Number(item.unit_price),
            return_qty: 0,
          };
        });

        setReturnItems(candidates);
      }
    } catch (err) {
      console.error('Error searching invoice:', err);
      showToast('حدث خطأ أثناء البحث عن الفاتورة', 'error');
    } finally {
      setSearching(false);
    }
  };

  // Update return quantity
  const handleQuantityChange = (saleItemId: string, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item) => {
        if (item.sale_item_id === saleItemId) {
          const validQty = Math.max(0, Math.min(qty, item.remaining_qty));
          return { ...item, return_qty: validQty };
        }
        return item;
      })
    );
  };

  // Calculate total refund
  const totalRefundAmount = returnItems.reduce(
    (acc, item) => acc + item.return_qty * item.unit_price,
    0
  );

  // Submit return
  const handleSubmitReturn = async () => {
    if (!user || !foundSale) return;

    const itemsToReturn = returnItems
      .filter((i) => i.return_qty > 0)
      .map((i) => ({
        sale_item_id: i.sale_item_id,
        quantity: i.return_qty,
      }));

    if (itemsToReturn.length === 0) {
      showToast('يرجى تحديد كمية للإرجاع لصنف واحد على الأقل', 'error');
      return;
    }

    setSubmittingReturn(true);

    try {
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedReturnNumber = `RET-${datePart}-${randomSuffix}`;

      // Call atomic process_return RPC
      const { data, error } = await supabase.rpc('process_return', {
        p_return_number: generatedReturnNumber,
        p_sale_id: foundSale.id,
        p_user_id: user.id,
        p_items: itemsToReturn,
        p_refund_method: refundMethod,
        p_reason: returnReason.trim() || null,
      });

      if (error) {
        console.error('Return RPC error:', error);
        showToast(error.message || 'حدث خطأ أثناء معالجة المرتجع في قاعدة البيانات', 'error');
        setSubmittingReturn(false);
        return;
      }

      showToast(`تم تنفيذ المرتجع رقم ${generatedReturnNumber} بنجاح`, 'success');

      setLastReturnResult({
        return_number: generatedReturnNumber,
        total_refund: totalRefundAmount,
        method: refundMethod,
      });
      setSuccessModalOpen(true);

      // Reset state
      setFoundSale(null);
      setReturnItems([]);
      setSearchInvoiceNumber('');
      setReturnReason('');
    } catch (err: any) {
      console.error('Fatal return error:', err);
      showToast(err.message || 'حدث خطأ غير متوقع أثناء معالجة المرتجع', 'error');
    } finally {
      setSubmittingReturn(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h3 className="font-bold text-base text-slate-900 mb-2">البحث عن الفاتورة الأصلية للمرتجع</h3>
        <p className="text-xs text-slate-500 mb-4">
          أدخل رقم الفاتورة الصادرة (مثال: INV-20260920-1234) لاختيار الأصناف المراد إرجاعها.
        </p>

        <form onSubmit={handleSearchInvoice} className="flex gap-3 max-w-lg">
          <div className="relative flex-1">
            <input
              type="text"
              value={searchInvoiceNumber}
              onChange={(e) => setSearchInvoiceNumber(e.target.value)}
              placeholder="رقم الفاتورة..."
              required
              className="w-full pl-4 pr-10 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all font-mono"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="py-3 px-6 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:bg-slate-400"
          >
            {searching ? 'جاري البحث...' : 'بحث'}
          </button>
        </form>
      </div>

      {/* Invoice Details & Return Candidates */}
      {foundSale && (
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 space-y-6">
          {/* Sale summary badge */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div>
              <p className="text-xs text-slate-500">الفاتورة المحددة:</p>
              <h4 className="font-mono font-bold text-slate-900 text-base">{foundSale.invoice_number}</h4>
            </div>
            <div>
              <p className="text-xs text-slate-500">تاريخ الإصدار:</p>
              <p className="text-xs font-medium text-slate-800">{formatDateTime(foundSale.created_at)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">الإجمالي الأصلي:</p>
              <p className="font-mono font-bold text-slate-900">{formatCurrency(foundSale.total_amount)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">الحالة الحالية:</p>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${getSaleStatusBadge(foundSale.status).className}`}>
                {getSaleStatusBadge(foundSale.status).label}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h4 className="font-bold text-sm text-slate-800 mb-3">حدد الأصناف والكميات المراد استرجاعها:</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-bold">الصنف</th>
                    <th className="py-2.5 px-4 font-bold text-center">الكمية المباعة</th>
                    <th className="py-2.5 px-4 font-bold text-center">تم إرجاعه مسبقاً</th>
                    <th className="py-2.5 px-4 font-bold text-center">المتبقي القابل للإرجاع</th>
                    <th className="py-2.5 px-4 font-bold text-left">سعر الوحدة</th>
                    <th className="py-2.5 px-4 font-bold text-center">كمية الإرجاع</th>
                    <th className="py-2.5 px-4 font-bold text-left">المبلغ المسترد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {returnItems.map((item) => (
                    <tr key={item.sale_item_id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.product_name}</td>
                      <td className="py-3 px-4 text-center font-mono">{item.sold_qty}</td>
                      <td className="py-3 px-4 text-center font-mono text-slate-500">
                        {item.previously_returned_qty}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-700">
                        {item.remaining_qty}
                      </td>
                      <td className="py-3 px-4 text-left font-mono">{formatCurrency(item.unit_price)}</td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          max={item.remaining_qty}
                          value={item.return_qty || ''}
                          disabled={item.remaining_qty === 0}
                          onChange={(e) =>
                            handleQuantityChange(item.sale_item_id, parseInt(e.target.value) || 0)
                          }
                          className="w-16 text-center py-1.5 px-2 rounded-xl border border-slate-200 font-mono font-bold text-xs focus:border-emerald-500 outline-none disabled:bg-slate-100"
                        />
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-bold text-emerald-600">
                        {formatCurrency(item.return_qty * item.unit_price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Refund Method & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                طريقة رد المبلغ للعميل:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: 'نقداً', icon: <Banknote className="w-4 h-4" /> },
                  { id: 'CARD', label: 'بطاقة / شبكة', icon: <CreditCard className="w-4 h-4" /> },
                  { id: 'TRANSFER', label: 'تحويل', icon: <ArrowRightLeft className="w-4 h-4" /> },
                  { id: 'WALLET', label: 'محفظة', icon: <Wallet className="w-4 h-4" /> },
                  { id: 'CREDIT', label: 'رصيد دائن', icon: <FileCheck className="w-4 h-4" /> },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setRefundMethod(m.id as PaymentMethod)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                      refundMethod === m.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.icon}
                    <span>{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                سبب الإرجاع (اختياري):
              </label>
              <input
                type="text"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                placeholder="مثال: خطأ في الطلب، إلغاء من العميل..."
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs focus:bg-white focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          {/* Confirm Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100">
            <div>
              <span className="text-xs text-slate-500">إجمالي المبلغ المسترد:</span>
              <span className="text-xl font-black font-mono text-emerald-600 mr-2">
                {formatCurrency(totalRefundAmount)}
              </span>
            </div>

            <button
              onClick={handleSubmitReturn}
              disabled={submittingReturn || totalRefundAmount <= 0}
              className="w-full sm:w-auto py-3 px-8 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{submittingReturn ? 'جاري معالجة المرتجع...' : 'تأكيد المرتجع وإعادة للمخزون'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Return Success Modal */}
      <Modal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        title="تم تسجيل المرتجع بنجاح"
        maxWidth="sm"
      >
        <div className="text-center py-4 space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <Check className="w-8 h-8" />
          </div>
          <div>
            <p className="text-xs text-slate-400">رقم إيصال المرتجع</p>
            <h4 className="font-mono font-bold text-base text-slate-900 mt-0.5">
              {lastReturnResult?.return_number}
            </h4>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500">المبلغ المسترد للعميل:</p>
            <p className="text-2xl font-black text-rose-600 font-mono mt-1">
              {formatCurrency(lastReturnResult?.total_refund)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              عبر: {getPaymentMethodLabel(lastReturnResult?.method)}
            </p>
          </div>
          <p className="text-xs text-emerald-700 font-medium">
            تمت إعادة الكميات تلقائياً إلى المخزون وتوثيق حركة المخزون.
          </p>
          <button
            onClick={() => setSuccessModalOpen(false)}
            className="w-full py-3 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </Modal>
    </div>
  );
};

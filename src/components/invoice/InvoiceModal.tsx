import React from 'react';
import { Modal } from '../common/Modal';
import { Printer, CheckCircle2, Utensils } from 'lucide-react';
import { formatCurrency, formatDateTime, getPaymentMethodLabel, getSaleStatusBadge } from '../../lib/utils';
import type { Sale, SaleItem, Payment } from '../../types/app';

interface InvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  items?: Array<SaleItem & { product_name?: string }>;
  payments?: Payment[];
  cashierName?: string;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  isOpen,
  onClose,
  sale,
  items = [],
  payments = [],
  cashierName,
}) => {
  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const statusBadge = getSaleStatusBadge(sale.status);
  const paymentMethod = payments.length > 0 ? payments[0].payment_method : 'CASH';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تفاصيل الفاتورة" maxWidth="lg">
      <div className="space-y-6">
        {/* Printable Receipt Container */}
        <div id="invoice-printable" className="bg-white p-6 rounded-2xl border border-slate-200 print:border-0 print:p-0 print:m-0 text-slate-800">
          {/* Header */}
          <div className="text-center pb-4 border-b border-dashed border-slate-300">
            <div className="inline-flex p-2 rounded-xl bg-slate-100 text-slate-800 mb-2 print:hidden">
              <Utensils className="w-6 h-6 text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">مطعم Mini ERP</h2>
            <p className="text-xs text-slate-500 mt-0.5">فاتورة ضريبية مبسطة</p>
          </div>

          {/* Metadata */}
          <div className="py-3 text-xs border-b border-dashed border-slate-300 space-y-1.5">
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الفاتورة:</span>
              <span className="font-mono font-bold text-slate-900">{sale.invoice_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">التاريخ والوقت:</span>
              <span>{formatDateTime(sale.created_at)}</span>
            </div>
            {cashierName && (
              <div className="flex justify-between">
                <span className="text-slate-500">الكاشير:</span>
                <span>{cashierName}</span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="text-slate-500">حالة الفاتورة:</span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${statusBadge.className}`}>
                {statusBadge.label}
              </span>
            </div>
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="text-slate-500 border-b border-slate-100 pb-1">
                  <th className="py-1">الصنف</th>
                  <th className="py-1 text-center">الكمية</th>
                  <th className="py-1 text-left">السعر</th>
                  <th className="py-1 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((item) => (
                  <tr key={item.id} className="text-slate-700">
                    <td className="py-1.5 font-medium">{item.product_name || 'منتج'}</td>
                    <td className="py-1.5 text-center font-mono">{item.quantity}</td>
                    <td className="py-1.5 text-left font-mono">{formatCurrency(item.unit_price)}</td>
                    <td className="py-1.5 text-left font-mono font-semibold">{formatCurrency(item.total_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="pt-3 text-xs space-y-1.5">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي:</span>
              <span className="font-mono">{formatCurrency(sale.subtotal)}</span>
            </div>

            {Number(sale.discount_amount) > 0 && (
              <div className="flex justify-between text-rose-600 font-medium">
                <span>الخصم المالي:</span>
                <span className="font-mono">-{formatCurrency(sale.discount_amount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
              <span>الإجمالي النهائي:</span>
              <span className="font-mono text-emerald-600 text-base">{formatCurrency(sale.total_amount)}</span>
            </div>

            <div className="flex justify-between text-slate-600 pt-1">
              <span>طريقة الدفع:</span>
              <span className="font-medium text-slate-800">{getPaymentMethodLabel(paymentMethod)}</span>
            </div>
          </div>

          {/* Footer message */}
          <div className="text-center pt-5 mt-2 border-t border-dashed border-slate-200 text-slate-400 text-[11px]">
            <p>شكراً لزيارتكم! نتطلع لخدمتكم دائماً.</p>
          </div>
        </div>

        {/* Modal Actions (Hidden in Print) */}
        <div className="flex items-center justify-end gap-3 no-print">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors text-sm"
          >
            إغلاق
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors text-sm shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الفاتورة</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};

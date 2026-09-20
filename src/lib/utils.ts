/**
 * Helper utilities for formatting and Arabic labels
 */

export function formatCurrency(amount: number | null | undefined): string {
  const val = Number(amount) || 0;
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}

export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  const d = new Date(dateString);
  return new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function getPaymentMethodLabel(method: string | null | undefined): string {
  switch (method?.toUpperCase()) {
    case 'CASH':
      return 'نقداً (كاش)';
    case 'CARD':
      return 'شبكة / بطاقة';
    case 'TRANSFER':
      return 'تحويل بنكي';
    case 'WALLET':
      return 'محفظة إلكترونية';
    case 'CREDIT':
      return 'على الحساب (آجل)';
    default:
      return method || 'غير محدد';
  }
}

export function getSaleStatusBadge(status: string | null | undefined): { label: string; className: string } {
  switch (status) {
    case 'COMPLETED':
      return { label: 'مكتملة', className: 'bg-green-100 text-green-800' };
    case 'RETURNED_PARTIAL':
      return { label: 'مرتجع جزئي', className: 'bg-amber-100 text-amber-800' };
    case 'RETURNED_FULL':
      return { label: 'مرتجع بالكامل', className: 'bg-red-100 text-red-800' };
    case 'CANCELLED':
      return { label: 'ملغاة', className: 'bg-slate-100 text-slate-800' };
    default:
      return { label: status || 'غير معروف', className: 'bg-slate-100 text-slate-800' };
  }
}

export function getStockStatusBadge(stock: number, minStock: number): { label: string; className: string } {
  if (stock <= 0) {
    return { label: 'نفد المخزون', className: 'bg-red-100 text-red-700 border-red-200' };
  }
  if (stock <= minStock) {
    return { label: 'مخزون منخفض', className: 'bg-amber-100 text-amber-700 border-amber-200' };
  }
  return { label: 'متوفر', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
}

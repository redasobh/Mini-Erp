import React, { useState, useEffect } from 'react';
import { Menu, ShoppingCart, Clock } from 'lucide-react';
import type { ViewType } from '../../types/app';

interface HeaderProps {
  currentView: ViewType;
  onOpenMobileMenu: () => void;
  onQuickPos: () => void;
}

const viewTitles: Record<ViewType, string> = {
  dashboard: 'لوحة المؤشرات الرئيسية',
  pos: 'شاشة نقطة البيع (POS)',
  sales: 'سجل المبيعات والفواتير',
  returns: 'إدارة المرتجعات ورد المبالغ',
  products: 'إدارة قائمة المنتجات والأسعار',
  categories: 'إدارة تصنيفات القائمة',
  inventory: 'مراقبة أرصدة المخزون',
  reports: 'التقارير والإحصائيات التشغيلية',
};

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenMobileMenu,
  onQuickPos,
}) => {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        new Intl.DateTimeFormat('ar-EG', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(now)
      );
    };

    updateTime();
    const interval = setInterval(updateTime, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm no-print">
      {/* Right side: Mobile Menu + Page Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileMenu}
          className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base font-bold text-slate-800">{viewTitles[currentView]}</h2>
      </div>

      {/* Left side: Quick POS + Clock */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>{timeStr}</span>
        </div>

        {currentView !== 'pos' && (
          <button
            onClick={onQuickPos}
            className="flex items-center gap-2 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>نقطة البيع (POS)</span>
          </button>
        )}
      </div>
    </header>
  );
};

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  RotateCcw,
  UtensilsCrossed,
  Tags,
  Boxes,
  BarChart3,
  LogOut,
  Utensils,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import type { ViewType } from '../../types/app';

interface SidebarProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  onLogoutClick: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onLogoutClick,
  isOpen,
  onClose,
}) => {
  const { profile, isAdmin } = useAuth();

  interface NavItem {
    id: ViewType;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }

  const navItems: NavItem[] = [
    {
      id: 'dashboard',
      label: 'الرئيسية',
      icon: <LayoutDashboard className="w-5 h-5" />,
      adminOnly: true,
    },
    {
      id: 'pos',
      label: 'نقطة البيع (POS)',
      icon: <ShoppingCart className="w-5 h-5" />,
    },
    {
      id: 'sales',
      label: 'سجل الفواتير',
      icon: <Receipt className="w-5 h-5" />,
    },
    {
      id: 'returns',
      label: 'المرتجعات',
      icon: <RotateCcw className="w-5 h-5" />,
    },
    {
      id: 'products',
      label: 'المنتجات والمنيو',
      icon: <UtensilsCrossed className="w-5 h-5" />,
      adminOnly: true,
    },
    {
      id: 'categories',
      label: 'التصنيفات',
      icon: <Tags className="w-5 h-5" />,
      adminOnly: true,
    },
    {
      id: 'inventory',
      label: 'حالة المخزون',
      icon: <Boxes className="w-5 h-5" />,
    },
    {
      id: 'reports',
      label: 'التقارير والإحصائيات',
      icon: <BarChart3 className="w-5 h-5" />,
      adminOnly: true,
    },
  ];

  const filteredNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 right-0 z-40 h-screen w-64 bg-slate-900 text-slate-100 flex flex-col border-l border-slate-800 transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } no-print`}
      >
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800 bg-slate-950/40">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-900/30">
            <Utensils className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white">Mini ERP</h1>
            <p className="text-xs text-slate-400">إدارة المطاعم</p>
          </div>
        </div>

        {/* User Card */}
        <div className="px-4 py-4 border-b border-slate-800 bg-slate-800/30">
          <div className="flex items-center justify-between">
            <div className="truncate">
              <p className="text-sm font-semibold text-white truncate">{profile?.full_name || 'موظف'}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.email}</p>
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin
                  ? 'bg-purple-900/60 text-purple-300 border border-purple-700/50'
                  : 'bg-emerald-900/60 text-emerald-300 border border-emerald-700/50'
              }`}
            >
              {isAdmin ? 'مدير' : 'كاشير'}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {filteredNavItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-950/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-slate-400'}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer / Logout */}
        <div className="p-3 border-t border-slate-800">
          <button
            onClick={onLogoutClick}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>
    </>
  );
};

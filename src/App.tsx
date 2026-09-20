import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { AppLayout } from './components/layout/AppLayout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Views
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { POSView } from './views/POSView';
import { SalesView } from './views/SalesView';
import { ReturnsView } from './views/ReturnsView';
import { ProductsView } from './views/ProductsView';
import { CategoriesView } from './views/CategoriesView';
import { InventoryView } from './views/InventoryView';
import { ReportsView } from './views/ReportsView';

import type { ViewType } from './types/app';

const MainApp: React.FC = () => {
  const { user, profile, loading: authLoading, isAdmin } = useAuth();
  const { showToast } = useToast();
  const [currentView, setCurrentView] = useState<ViewType>('pos');

  // Set initial default view based on role
  useEffect(() => {
    if (profile) {
      if (profile.role === 'admin') {
        setCurrentView('dashboard');
      } else {
        setCurrentView('pos');
      }
    }
  }, [profile]);

  // Protect Admin views from Agent
  const handleNavigate = (view: ViewType) => {
    const adminOnlyViews: ViewType[] = ['dashboard', 'products', 'categories', 'reports'];
    if (adminOnlyViews.includes(view) && !isAdmin) {
      showToast('عذراً، هذه الشاشة مخصصة لإدارة النظام فقط', 'error');
      setCurrentView('pos');
      return;
    }
    setCurrentView(view);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <LoadingSpinner message="جاري تهيئة نظام المطعم..." size="lg" />
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  return (
    <AppLayout currentView={currentView} onNavigate={handleNavigate}>
      {currentView === 'dashboard' && <DashboardView onNavigate={handleNavigate} />}
      {currentView === 'pos' && <POSView />}
      {currentView === 'sales' && <SalesView />}
      {currentView === 'returns' && <ReturnsView />}
      {currentView === 'products' && <ProductsView />}
      {currentView === 'categories' && <CategoriesView />}
      {currentView === 'inventory' && <InventoryView />}
      {currentView === 'reports' && <ReportsView />}
    </AppLayout>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
}

import type { Database, PaymentMethod, RoleName, SaleStatus } from './database';

export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Sale = Database['public']['Tables']['sales']['Row'];
export type SaleItem = Database['public']['Tables']['sale_items']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type ReturnHeader = Database['public']['Tables']['returns']['Row'];
export type ReturnItem = Database['public']['Tables']['return_items']['Row'];
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: RoleName;
}

export interface CartItem {
  product_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  available_stock: number;
  total: number;
}

export type ViewType =
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'returns'
  | 'reports';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

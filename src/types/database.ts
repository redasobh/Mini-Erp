export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type RoleName = 'admin' | 'agent';
export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER' | 'WALLET' | 'CREDIT';
export type SaleStatus = 'COMPLETED' | 'RETURNED_PARTIAL' | 'RETURNED_FULL' | 'CANCELLED';
export type MovementType = 'SALE' | 'RETURN' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'INITIAL';

export interface Database {
  public: {
    Tables: {
      roles: {
        Row: {
          id: number;
          name: RoleName;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: number;
          name: RoleName;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: number;
          name?: RoleName;
          description?: string | null;
          created_at?: string;
        };
      };
      users: {
        Row: {
          id: string;
          role_id: number;
          full_name: string;
          email: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role_id: number;
          full_name: string;
          email: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role_id?: number;
          full_name?: string;
          email?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          category_id: string;
          name: string;
          price: number;
          cost_price: number;
          stock_quantity: number;
          min_stock_level: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          name: string;
          price: number;
          cost_price?: number;
          stock_quantity?: number;
          min_stock_level?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          name?: string;
          price?: number;
          cost_price?: number;
          stock_quantity?: number;
          min_stock_level?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      sales: {
        Row: {
          id: string;
          invoice_number: string;
          user_id: string;
          subtotal: number;
          discount_amount: number;
          total_amount: number;
          status: SaleStatus;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          user_id: string;
          subtotal: number;
          discount_amount?: number;
          total_amount: number;
          status?: SaleStatus;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          user_id?: string;
          subtotal?: number;
          discount_amount?: number;
          total_amount?: number;
          status?: SaleStatus;
          notes?: string | null;
          created_at?: string;
        };
      };
      sale_items: {
        Row: {
          id: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          cost_price: number;
          total_price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          cost_price?: number;
          total_price: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          cost_price?: number;
          total_price?: number;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          sale_id: string;
          payment_method: PaymentMethod;
          amount: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          sale_id: string;
          payment_method: PaymentMethod;
          amount: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          sale_id?: string;
          payment_method?: PaymentMethod;
          amount?: number;
          created_at?: string;
        };
      };
      returns: {
        Row: {
          id: string;
          return_number: string;
          sale_id: string;
          user_id: string;
          total_refund_amount: number;
          refund_method: PaymentMethod;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          return_number: string;
          sale_id: string;
          user_id: string;
          total_refund_amount: number;
          refund_method: PaymentMethod;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          return_number?: string;
          sale_id?: string;
          user_id?: string;
          total_refund_amount?: number;
          refund_method?: PaymentMethod;
          reason?: string | null;
          created_at?: string;
        };
      };
      return_items: {
        Row: {
          id: string;
          return_id: string;
          sale_item_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_refund: number;
        };
        Insert: {
          id?: string;
          return_id: string;
          sale_item_id: string;
          product_id: string;
          quantity: number;
          unit_price: number;
          total_refund: number;
        };
        Update: {
          id?: string;
          return_id?: string;
          sale_item_id?: string;
          product_id?: string;
          quantity?: number;
          unit_price?: number;
          total_refund?: number;
        };
      };
      stock_movements: {
        Row: {
          id: string;
          product_id: string;
          movement_type: MovementType;
          quantity_delta: number;
          reference_type: 'SALE' | 'RETURN' | 'MANUAL';
          reference_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          movement_type: MovementType;
          quantity_delta: number;
          reference_type: 'SALE' | 'RETURN' | 'MANUAL';
          reference_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          movement_type?: MovementType;
          quantity_delta?: number;
          reference_type?: 'SALE' | 'RETURN' | 'MANUAL';
          reference_id?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
    };
    Functions: {
      complete_sale: {
        Args: {
          p_invoice_number: string;
          p_user_id: string;
          p_items: Json;
          p_payment_method: PaymentMethod;
          p_discount_amount?: number;
          p_notes?: string | null;
        };
        Returns: Json;
      };
      process_return: {
        Args: {
          p_return_number: string;
          p_sale_id: string;
          p_user_id: string;
          p_items: Json;
          p_refund_method: PaymentMethod;
          p_reason?: string | null;
        };
        Returns: Json;
      };
      get_current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
  };
}

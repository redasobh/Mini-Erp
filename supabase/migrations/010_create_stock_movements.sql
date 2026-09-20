-- Migration 010: Create Stock Movements Table
CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('SALE', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'INITIAL')),
    quantity_delta INTEGER NOT NULL CHECK (quantity_delta != 0),
    reference_type VARCHAR(30) NOT NULL CHECK (reference_type IN ('SALE', 'RETURN', 'MANUAL')),
    reference_id UUID,
    created_by UUID NOT NULL REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);

COMMENT ON TABLE public.stock_movements IS 'Immutable ledger tracking every inventory quantity change with source';

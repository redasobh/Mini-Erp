-- Migration 009: Create Return Items Table
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_refund NUMERIC(10, 2) NOT NULL CHECK (total_refund >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_sale_item_id ON public.return_items(sale_item_id);

COMMENT ON TABLE public.return_items IS 'Return line items tracking original sale item and refunded quantity';

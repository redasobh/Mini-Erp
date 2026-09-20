-- Migration 008: Create Returns Table
CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number VARCHAR(50) NOT NULL UNIQUE,
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    total_refund_amount NUMERIC(10, 2) NOT NULL CHECK (total_refund_amount >= 0),
    refund_method VARCHAR(30) NOT NULL CHECK (refund_method IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT')),
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON public.returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON public.returns(return_number);

COMMENT ON TABLE public.returns IS 'Return headers linked directly to original sales';

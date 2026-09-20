-- ====================================================================
-- MINI ERP RESTAURANT SYSTEM - COMPLETE DATABASE SCHEMA (PHASE 2)
-- PostgreSQL / Supabase Migration
-- ====================================================================

-- 1. Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id SMALLSERIAL PRIMARY KEY,
    name VARCHAR(30) NOT NULL UNIQUE,
    description VARCHAR(150),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Users (Profiles linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id SMALLINT NOT NULL REFERENCES public.roles(id) ON DELETE RESTRICT,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function for auto-profile creation on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id SMALLINT;
    user_role_name TEXT;
BEGIN
    user_role_name := COALESCE(NEW.raw_user_meta_data->>'role', 'agent');
    
    SELECT id INTO default_role_id FROM public.roles WHERE name = user_role_name LIMIT 1;
    
    IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public.roles WHERE name = 'agent' LIMIT 1;
    END IF;

    INSERT INTO public.users (id, role_id, full_name, email, is_active)
    VALUES (
        NEW.id,
        default_role_id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.email,
        TRUE
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Categories
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Products
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_level INTEGER NOT NULL DEFAULT 5 CHECK (min_stock_level >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON public.products(stock_quantity, min_stock_level) WHERE is_active = TRUE;

-- 5. Sales (Invoices)
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED' CHECK (status IN ('COMPLETED', 'RETURNED_PARTIAL', 'RETURNED_FULL', 'CANCELLED')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON public.sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_user_id ON public.sales(user_id);

-- 6. Sale Items
CREATE TABLE IF NOT EXISTS public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    cost_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sale_item UNIQUE (sale_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON public.sale_items(product_id);

-- 7. Payments
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT')),
    amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON public.payments(sale_id);

-- 8. Returns
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

CREATE INDEX IF NOT EXISTS idx_returns_sale_id ON public.returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_returns_return_number ON public.returns(return_number);

-- 9. Return Items
CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID NOT NULL REFERENCES public.returns(id) ON DELETE CASCADE,
    sale_item_id UUID NOT NULL REFERENCES public.sale_items(id) ON DELETE RESTRICT,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_refund NUMERIC(10, 2) NOT NULL CHECK (total_refund >= 0)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON public.return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_return_items_sale_item_id ON public.return_items(sale_item_id);

-- 10. Stock Movements
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

CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON public.stock_movements(created_at);

-- 11. Atomic Functions (complete_sale & process_return)
CREATE OR REPLACE FUNCTION public.complete_sale(
    p_invoice_number VARCHAR(50),
    p_user_id UUID,
    p_items JSONB,
    p_payment_method VARCHAR(30),
    p_discount_amount NUMERIC(10, 2) DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_product_id UUID;
    v_qty INTEGER;
    v_price NUMERIC(10, 2);
    v_cost NUMERIC(10, 2);
    v_stock INTEGER;
    v_product_name VARCHAR(150);
    v_is_active BOOLEAN;
    v_subtotal NUMERIC(10, 2) := 0.00;
    v_total_amount NUMERIC(10, 2) := 0.00;
    v_item_total NUMERIC(10, 2);
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'المستخدم غير صالح أو غير نشط';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'لا يمكن إنشاء فاتورة بدون منتجات';
    END IF;

    IF p_payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT') THEN
        RAISE EXCEPTION 'طريقة الدفع غير صالحة';
    END IF;

    IF EXISTS (SELECT 1 FROM public.sales WHERE invoice_number = p_invoice_number) THEN
        RAISE EXCEPTION 'رقم الفاتورة مستخدم بالفعل';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية المنتج يجب أن تكون أكبر من الصفر';
        END IF;

        SELECT name, price, cost_price, stock_quantity, is_active
        INTO v_product_name, v_price, v_cost, v_stock, v_is_active
        FROM public.products
        WHERE id = v_product_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'المنتج غير موجود: %', v_product_id;
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'المنتج غير متاح للبيع حالياً: %', v_product_name;
        END IF;

        IF v_stock < v_qty THEN
            RAISE EXCEPTION 'الكمية المطلوبة من المنتج (%) غير متوفرة في المخزون (المتوفر: %)', v_product_name, v_stock;
        END IF;

        v_item_total := v_price * v_qty;
        v_subtotal := v_subtotal + v_item_total;
    END LOOP;

    IF p_discount_amount < 0 THEN
        RAISE EXCEPTION 'قيمة الخصم لا يمكن أن تكون سالبة';
    END IF;

    IF p_discount_amount > v_subtotal THEN
        RAISE EXCEPTION 'قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة';
    END IF;

    v_total_amount := v_subtotal - p_discount_amount;

    INSERT INTO public.sales (
        invoice_number, user_id, subtotal, discount_amount, total_amount, status, notes
    ) VALUES (
        p_invoice_number, p_user_id, v_subtotal, p_discount_amount, v_total_amount, 'COMPLETED', p_notes
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT price, cost_price INTO v_price, v_cost
        FROM public.products
        WHERE id = v_product_id;

        v_item_total := v_price * v_qty;

        INSERT INTO public.sale_items (
            sale_id, product_id, quantity, unit_price, cost_price, total_price
        ) VALUES (
            v_sale_id, v_product_id, v_qty, v_price, v_cost, v_item_total
        );

        UPDATE public.products
        SET stock_quantity = stock_quantity - v_qty,
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.stock_movements (
            product_id, movement_type, quantity_delta, reference_type, reference_id, created_by
        ) VALUES (
            v_product_id, 'SALE', -v_qty, 'SALE', v_sale_id, p_user_id
        );
    END LOOP;

    INSERT INTO public.payments (
        sale_id, payment_method, amount
    ) VALUES (
        v_sale_id, p_payment_method, v_total_amount
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'sale_id', v_sale_id,
        'invoice_number', p_invoice_number,
        'subtotal', v_subtotal,
        'discount_amount', p_discount_amount,
        'total_amount', v_total_amount,
        'payment_method', p_payment_method
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.process_return(
    p_return_number VARCHAR(50),
    p_sale_id UUID,
    p_user_id UUID,
    p_items JSONB,
    p_refund_method VARCHAR(30),
    p_reason VARCHAR(255) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_return_id UUID;
    v_sale_status VARCHAR(20);
    v_item JSONB;
    v_sale_item_id UUID;
    v_product_id UUID;
    v_qty INTEGER;
    v_sold_qty INTEGER;
    v_unit_price NUMERIC(10, 2);
    v_prev_returned_qty INTEGER;
    v_total_refund NUMERIC(10, 2) := 0.00;
    v_item_refund NUMERIC(10, 2);
    v_all_items_fully_returned BOOLEAN := TRUE;
    v_rec RECORD;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'المستخدم غير صالح أو غير نشط';
    END IF;

    IF p_refund_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT') THEN
        RAISE EXCEPTION 'طريقة استرداد المبلغ غير صالحة';
    END IF;

    SELECT status INTO v_sale_status FROM public.sales WHERE id = p_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفاتورة الأصلية غير موجودة';
    END IF;

    IF v_sale_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'لا يمكن عمل مرتجع لفاتورة ملغاة';
    END IF;

    IF v_sale_status = 'RETURNED_FULL' THEN
        RAISE EXCEPTION 'تم إرجاع هذه الفاتورة بالكامل مسبقاً';
    END IF;

    IF EXISTS (SELECT 1 FROM public.returns WHERE return_number = p_return_number) THEN
        RAISE EXCEPTION 'رقم المرتجع مستخدم بالفعل';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'يجب تحديد الأصناف المراد إرجاعها';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية المرتجع يجب أن تكون أكبر من الصفر';
        END IF;

        SELECT product_id, quantity, unit_price
        INTO v_product_id, v_sold_qty, v_unit_price
        FROM public.sale_items
        WHERE id = v_sale_item_id AND sale_id = p_sale_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'الصنف المحدد غير موجود في الفاتورة الأصلية: %', v_sale_item_id;
        END IF;

        SELECT COALESCE(SUM(quantity), 0)
        INTO v_prev_returned_qty
        FROM public.return_items
        WHERE sale_item_id = v_sale_item_id;

        IF (v_prev_returned_qty + v_qty) > v_sold_qty THEN
            RAISE EXCEPTION 'الكمية المراد إرجاعها (%) تتجاوز الكمية المتبقية القابلة للإرجاع (%)',
                v_qty, (v_sold_qty - v_prev_returned_qty);
        END IF;

        v_item_refund := v_unit_price * v_qty;
        v_total_refund := v_total_refund + v_item_refund;
    END LOOP;

    INSERT INTO public.returns (
        return_number, sale_id, user_id, total_refund_amount, refund_method, reason
    ) VALUES (
        p_return_number, p_sale_id, p_user_id, v_total_refund, p_refund_method, p_reason
    ) RETURNING id INTO v_return_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT product_id, unit_price
        INTO v_product_id, v_unit_price
        FROM public.sale_items
        WHERE id = v_sale_item_id;

        v_item_refund := v_unit_price * v_qty;

        INSERT INTO public.return_items (
            return_id, sale_item_id, product_id, quantity, unit_price, total_refund
        ) VALUES (
            v_return_id, v_sale_item_id, v_product_id, v_qty, v_unit_price, v_item_refund
        );

        UPDATE public.products
        SET stock_quantity = stock_quantity + v_qty,
            updated_at = NOW()
        WHERE id = v_product_id;

        INSERT INTO public.stock_movements (
            product_id, movement_type, quantity_delta, reference_type, reference_id, created_by
        ) VALUES (
            v_product_id, 'RETURN', v_qty, 'RETURN', v_return_id, p_user_id
        );
    END LOOP;

    FOR v_rec IN
        SELECT si.id, si.quantity AS sold_qty, COALESCE(SUM(ri.quantity), 0) AS returned_qty
        FROM public.sale_items si
        LEFT JOIN public.return_items ri ON si.id = ri.sale_item_id
        WHERE si.sale_id = p_sale_id
        GROUP BY si.id, si.quantity
    LOOP
        IF v_rec.returned_qty < v_rec.sold_qty THEN
            v_all_items_fully_returned := FALSE;
            EXIT;
        END IF;
    END LOOP;

    IF v_all_items_fully_returned THEN
        UPDATE public.sales SET status = 'RETURNED_FULL' WHERE id = p_sale_id;
    ELSE
        UPDATE public.sales SET status = 'RETURNED_PARTIAL' WHERE id = p_sale_id;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'return_id', v_return_id,
        'return_number', p_return_number,
        'sale_id', p_sale_id,
        'total_refund_amount', v_total_refund,
        'refund_method', p_refund_method,
        'status', CASE WHEN v_all_items_fully_returned THEN 'RETURNED_FULL' ELSE 'RETURNED_PARTIAL' END
    );
END;
$$;

-- 12. Row Level Security (RLS) & Policies
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS VARCHAR
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
    v_role VARCHAR;
BEGIN
    SELECT r.name INTO v_role
    FROM public.users u
    JOIN public.roles r ON u.role_id = r.id
    WHERE u.id = auth.uid() AND u.is_active = TRUE;
    
    RETURN COALESCE(v_role, 'anonymous');
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN public.get_current_user_role() = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_agent_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN public.get_current_user_role() IN ('admin', 'agent');
END;
$$;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Roles
DROP POLICY IF EXISTS "Allow authenticated read roles" ON public.roles;
CREATE POLICY "Allow authenticated read roles" ON public.roles FOR SELECT TO authenticated, anon USING (TRUE);

DROP POLICY IF EXISTS "Admin full management roles" ON public.roles;
CREATE POLICY "Admin full management roles" ON public.roles FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Users
DROP POLICY IF EXISTS "Users read own profile or admin read all" ON public.users;
CREATE POLICY "Users read own profile or admin read all" ON public.users FOR SELECT TO authenticated USING (public.is_admin() OR id = auth.uid());

DROP POLICY IF EXISTS "Admin insert users" ON public.users;
CREATE POLICY "Admin insert users" ON public.users FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin update users or user update self without role change" ON public.users;
CREATE POLICY "Admin update users or user update self without role change" ON public.users FOR UPDATE TO authenticated USING (public.is_admin() OR id = auth.uid()) WITH CHECK (public.is_admin() OR (id = auth.uid() AND role_id = (SELECT role_id FROM public.users WHERE id = auth.uid())));

-- Categories
DROP POLICY IF EXISTS "Read active categories or admin read all" ON public.categories;
CREATE POLICY "Read active categories or admin read all" ON public.categories FOR SELECT TO authenticated, anon USING (public.is_admin() OR is_active = TRUE);

DROP POLICY IF EXISTS "Admin manage categories" ON public.categories;
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Products
DROP POLICY IF EXISTS "Read active products or admin read all" ON public.products;
CREATE POLICY "Read active products or admin read all" ON public.products FOR SELECT TO authenticated, anon USING (public.is_admin() OR is_active = TRUE);

DROP POLICY IF EXISTS "Admin manage products" ON public.products;
CREATE POLICY "Admin manage products" ON public.products FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Sales
DROP POLICY IF EXISTS "Staff read sales" ON public.sales;
CREATE POLICY "Staff read sales" ON public.sales FOR SELECT TO authenticated USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert sales" ON public.sales;
CREATE POLICY "Staff insert sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Admin update sales status" ON public.sales;
CREATE POLICY "Admin update sales status" ON public.sales FOR UPDATE TO authenticated USING (public.is_admin());

-- Sale items
DROP POLICY IF EXISTS "Staff read sale items" ON public.sale_items;
CREATE POLICY "Staff read sale items" ON public.sale_items FOR SELECT TO authenticated USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert sale items" ON public.sale_items;
CREATE POLICY "Staff insert sale items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (public.is_agent_or_admin());

-- Payments
DROP POLICY IF EXISTS "Staff read payments" ON public.payments;
CREATE POLICY "Staff read payments" ON public.payments FOR SELECT TO authenticated USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert payments" ON public.payments;
CREATE POLICY "Staff insert payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (public.is_agent_or_admin());

-- Returns
DROP POLICY IF EXISTS "Staff read returns" ON public.returns;
CREATE POLICY "Staff read returns" ON public.returns FOR SELECT TO authenticated USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert returns" ON public.returns;
CREATE POLICY "Staff insert returns" ON public.returns FOR INSERT TO authenticated WITH CHECK (public.is_agent_or_admin());

-- Return items
DROP POLICY IF EXISTS "Staff read return items" ON public.return_items;
CREATE POLICY "Staff read return items" ON public.return_items FOR SELECT TO authenticated USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert return items" ON public.return_items;
CREATE POLICY "Staff insert return items" ON public.return_items FOR INSERT TO authenticated WITH CHECK (public.is_agent_or_admin());

-- Stock movements
DROP POLICY IF EXISTS "Admin view stock movements" ON public.stock_movements;
CREATE POLICY "Admin view stock movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin insert stock adjustments" ON public.stock_movements;
CREATE POLICY "Admin insert stock adjustments" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 13. Seed Data
INSERT INTO public.roles (name, description) VALUES
    ('admin', 'Full system administrator with complete operational and managerial privileges'),
    ('agent', 'Operational cashier with point-of-sale and return privileges')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.categories (id, name, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Meals', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'Drinks', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'Desserts', TRUE)
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (id, category_id, name, price, cost_price, stock_quantity, min_stock_level, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Burger', 25.00, 15.00, 50, 10, TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Cola', 5.00, 2.50, 100, 20, TRUE),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fries', 10.00, 4.00, 40, 10, TRUE)
ON CONFLICT (id) DO NOTHING;

-- 14. Permissions (Grants for PostgREST / Supabase API)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';


-- Migration 012: Row Level Security (RLS) Policies and Security Helpers

-- 1. Helper functions to determine user role securely
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

-- 2. Enable RLS on all tables
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

-- ----------------------------------------------------
-- ROLES POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Allow authenticated read roles" ON public.roles;
CREATE POLICY "Allow authenticated read roles"
    ON public.roles FOR SELECT
    TO authenticated, anon
    USING (TRUE);

DROP POLICY IF EXISTS "Admin full management roles" ON public.roles;
CREATE POLICY "Admin full management roles"
    ON public.roles FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------
-- USERS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile or admin read all" ON public.users;
CREATE POLICY "Users read own profile or admin read all"
    ON public.users FOR SELECT
    TO authenticated
    USING (public.is_admin() OR id = auth.uid());

DROP POLICY IF EXISTS "Admin insert users" ON public.users;
CREATE POLICY "Admin insert users"
    ON public.users FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin update users or user update self without role change" ON public.users;
CREATE POLICY "Admin update users or user update self without role change"
    ON public.users FOR UPDATE
    TO authenticated
    USING (public.is_admin() OR id = auth.uid())
    WITH CHECK (public.is_admin() OR (id = auth.uid() AND role_id = (SELECT role_id FROM public.users WHERE id = auth.uid())));

-- ----------------------------------------------------
-- CATEGORIES POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Read active categories or admin read all" ON public.categories;
CREATE POLICY "Read active categories or admin read all"
    ON public.categories FOR SELECT
    TO authenticated, anon
    USING (public.is_admin() OR is_active = TRUE);

DROP POLICY IF EXISTS "Admin manage categories" ON public.categories;
CREATE POLICY "Admin manage categories"
    ON public.categories FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------
-- PRODUCTS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Read active products or admin read all" ON public.products;
CREATE POLICY "Read active products or admin read all"
    ON public.products FOR SELECT
    TO authenticated, anon
    USING (public.is_admin() OR is_active = TRUE);

DROP POLICY IF EXISTS "Admin manage products" ON public.products;
CREATE POLICY "Admin manage products"
    ON public.products FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------
-- SALES POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Staff read sales" ON public.sales;
CREATE POLICY "Staff read sales"
    ON public.sales FOR SELECT
    TO authenticated
    USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert sales" ON public.sales;
CREATE POLICY "Staff insert sales"
    ON public.sales FOR INSERT
    TO authenticated
    WITH CHECK (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Admin update sales status" ON public.sales;
CREATE POLICY "Admin update sales status"
    ON public.sales FOR UPDATE
    TO authenticated
    USING (public.is_admin());

-- ----------------------------------------------------
-- SALE ITEMS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Staff read sale items" ON public.sale_items;
CREATE POLICY "Staff read sale items"
    ON public.sale_items FOR SELECT
    TO authenticated
    USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert sale items" ON public.sale_items;
CREATE POLICY "Staff insert sale items"
    ON public.sale_items FOR INSERT
    TO authenticated
    WITH CHECK (public.is_agent_or_admin());

-- ----------------------------------------------------
-- PAYMENTS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Staff read payments" ON public.payments;
CREATE POLICY "Staff read payments"
    ON public.payments FOR SELECT
    TO authenticated
    USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert payments" ON public.payments;
CREATE POLICY "Staff insert payments"
    ON public.payments FOR INSERT
    TO authenticated
    WITH CHECK (public.is_agent_or_admin());

-- ----------------------------------------------------
-- RETURNS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Staff read returns" ON public.returns;
CREATE POLICY "Staff read returns"
    ON public.returns FOR SELECT
    TO authenticated
    USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert returns" ON public.returns;
CREATE POLICY "Staff insert returns"
    ON public.returns FOR INSERT
    TO authenticated
    WITH CHECK (public.is_agent_or_admin());

-- ----------------------------------------------------
-- RETURN ITEMS POLICIES
-- ----------------------------------------------------
DROP POLICY IF EXISTS "Staff read return items" ON public.return_items;
CREATE POLICY "Staff read return items"
    ON public.return_items FOR SELECT
    TO authenticated
    USING (public.is_agent_or_admin());

DROP POLICY IF EXISTS "Staff insert return items" ON public.return_items;
CREATE POLICY "Staff insert return items"
    ON public.return_items FOR INSERT
    TO authenticated
    WITH CHECK (public.is_agent_or_admin());

-- ----------------------------------------------------
-- STOCK MOVEMENTS POLICIES
-- ----------------------------------------------------
-- Only Admins can view the raw stock ledger directly
DROP POLICY IF EXISTS "Admin view stock movements" ON public.stock_movements;
CREATE POLICY "Admin view stock movements"
    ON public.stock_movements FOR SELECT
    TO authenticated
    USING (public.is_admin());

-- Only Admins can manually insert stock adjustments directly;
-- System movements (SALE, RETURN) are inserted via SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Admin insert stock adjustments" ON public.stock_movements;
CREATE POLICY "Admin insert stock adjustments"
    ON public.stock_movements FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin());

-- ----------------------------------------------------
-- PERMISSIONS (Grants for PostgREST / Supabase API)
-- ----------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';



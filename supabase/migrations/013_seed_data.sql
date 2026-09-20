-- Migration 013: Seed Data for Testing

-- 1. Seed Roles
INSERT INTO public.roles (name, description) VALUES
    ('admin', 'Full system administrator with complete operational and managerial privileges'),
    ('agent', 'Operational cashier with point-of-sale and return privileges')
ON CONFLICT (name) DO NOTHING;

-- 2. Seed Categories
INSERT INTO public.categories (id, name, is_active) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Meals', TRUE),
    ('22222222-2222-2222-2222-222222222222', 'Drinks', TRUE),
    ('33333333-3333-3333-3333-333333333333', 'Desserts', TRUE)
ON CONFLICT (name) DO NOTHING;

-- 3. Seed Products (Burger, Cola, Fries)
INSERT INTO public.products (id, category_id, name, price, cost_price, stock_quantity, min_stock_level, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Burger', 25.00, 15.00, 50, 10, TRUE),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'Cola', 5.00, 2.50, 100, 20, TRUE),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'Fries', 10.00, 4.00, 40, 10, TRUE)
ON CONFLICT (id) DO NOTHING;

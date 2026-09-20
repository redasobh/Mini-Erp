-- Migration 011: Database Functions for Atomic Operations (Sales & Returns)

-- 1. Function to complete a sale atomically
CREATE OR REPLACE FUNCTION public.complete_sale(
    p_invoice_number VARCHAR(50),
    p_user_id UUID,
    p_items JSONB, -- Array of objects: [{"product_id": "...", "quantity": 2}]
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
    -- Check user existence
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'المستخدم غير صالح أو غير نشط';
    END IF;

    -- Validate items list is not empty
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'لا يمكن إنشاء فاتورة بدون منتجات';
    END IF;

    -- Validate payment method
    IF p_payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT') THEN
        RAISE EXCEPTION 'طريقة الدفع غير صالحة';
    END IF;

    -- Check unique invoice number
    IF EXISTS (SELECT 1 FROM public.sales WHERE invoice_number = p_invoice_number) THEN
        RAISE EXCEPTION 'رقم الفاتورة مستخدم بالفعل';
    END IF;

    -- Calculate subtotal and validate stock for all items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية المنتج يجب أن تكون أكبر من الصفر';
        END IF;

        -- Lock product row for atomic stock check and update
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

    -- Calculate final total
    IF p_discount_amount < 0 THEN
        RAISE EXCEPTION 'قيمة الخصم لا يمكن أن تكون سالبة';
    END IF;

    IF p_discount_amount > v_subtotal THEN
        RAISE EXCEPTION 'قيمة الخصم لا يمكن أن تتجاوز إجمالي الفاتورة';
    END IF;

    v_total_amount := v_subtotal - p_discount_amount;

    -- 1. Insert into sales
    INSERT INTO public.sales (
        invoice_number,
        user_id,
        subtotal,
        discount_amount,
        total_amount,
        status,
        notes
    ) VALUES (
        p_invoice_number,
        p_user_id,
        v_subtotal,
        p_discount_amount,
        v_total_amount,
        'COMPLETED',
        p_notes
    ) RETURNING id INTO v_sale_id;

    -- 2. Insert items, decrease stock, and record stock movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT price, cost_price INTO v_price, v_cost
        FROM public.products
        WHERE id = v_product_id;

        v_item_total := v_price * v_qty;

        -- Insert sale item with snapshot prices
        INSERT INTO public.sale_items (
            sale_id,
            product_id,
            quantity,
            unit_price,
            cost_price,
            total_price
        ) VALUES (
            v_sale_id,
            v_product_id,
            v_qty,
            v_price,
            v_cost,
            v_item_total
        );

        -- Decrease stock
        UPDATE public.products
        SET stock_quantity = stock_quantity - v_qty,
            updated_at = NOW()
        WHERE id = v_product_id;

        -- Record stock movement
        INSERT INTO public.stock_movements (
            product_id,
            movement_type,
            quantity_delta,
            reference_type,
            reference_id,
            created_by
        ) VALUES (
            v_product_id,
            'SALE',
            -v_qty,
            'SALE',
            v_sale_id,
            p_user_id
        );
    END LOOP;

    -- 3. Record payment
    INSERT INTO public.payments (
        sale_id,
        payment_method,
        amount
    ) VALUES (
        v_sale_id,
        p_payment_method,
        v_total_amount
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

-- 2. Function to process a return atomically
CREATE OR REPLACE FUNCTION public.process_return(
    p_return_number VARCHAR(50),
    p_sale_id UUID,
    p_user_id UUID,
    p_items JSONB, -- Array of objects: [{"sale_item_id": "...", "quantity": 1}]
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
    -- Validate user
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id AND is_active = TRUE) THEN
        RAISE EXCEPTION 'المستخدم غير صالح أو غير نشط';
    END IF;

    -- Validate refund method
    IF p_refund_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'WALLET', 'CREDIT') THEN
        RAISE EXCEPTION 'طريقة استرداد المبلغ غير صالحة';
    END IF;

    -- Validate sale existence and status
    SELECT status INTO v_sale_status
    FROM public.sales
    WHERE id = p_sale_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'الفاتورة الأصلية غير موجودة';
    END IF;

    IF v_sale_status = 'CANCELLED' THEN
        RAISE EXCEPTION 'لا يمكن عمل مرتجع لفاتورة ملغاة';
    END IF;

    IF v_sale_status = 'RETURNED_FULL' THEN
        RAISE EXCEPTION 'تم إرجاع هذه الفاتورة بالكامل مسبقاً';
    END IF;

    -- Check unique return number
    IF EXISTS (SELECT 1 FROM public.returns WHERE return_number = p_return_number) THEN
        RAISE EXCEPTION 'رقم المرتجع مستخدم بالفعل';
    END IF;

    -- Validate items list
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'يجب تحديد الأصناف المراد إرجاعها';
    END IF;

    -- Validate each item and calculate refund
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        IF v_qty <= 0 THEN
            RAISE EXCEPTION 'كمية المرتجع يجب أن تكون أكبر من الصفر';
        END IF;

        -- Find original sale item
        SELECT product_id, quantity, unit_price
        INTO v_product_id, v_sold_qty, v_unit_price
        FROM public.sale_items
        WHERE id = v_sale_item_id AND sale_id = p_sale_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'الصنف المحدد غير موجود في الفاتورة الأصلية: %', v_sale_item_id;
        END IF;

        -- Calculate previously returned quantity for this item
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

    -- 1. Insert return header
    INSERT INTO public.returns (
        return_number,
        sale_id,
        user_id,
        total_refund_amount,
        refund_method,
        reason
    ) VALUES (
        p_return_number,
        p_sale_id,
        p_user_id,
        v_total_refund,
        p_refund_method,
        p_reason
    ) RETURNING id INTO v_return_id;

    -- 2. Insert return items, increase stock, and record stock movements
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_sale_item_id := (v_item->>'sale_item_id')::UUID;
        v_qty := (v_item->>'quantity')::INTEGER;

        SELECT product_id, unit_price
        INTO v_product_id, v_unit_price
        FROM public.sale_items
        WHERE id = v_sale_item_id;

        v_item_refund := v_unit_price * v_qty;

        -- Insert return item
        INSERT INTO public.return_items (
            return_id,
            sale_item_id,
            product_id,
            quantity,
            unit_price,
            total_refund
        ) VALUES (
            v_return_id,
            v_sale_item_id,
            v_product_id,
            v_qty,
            v_unit_price,
            v_item_refund
        );

        -- Increase stock
        UPDATE public.products
        SET stock_quantity = stock_quantity + v_qty,
            updated_at = NOW()
        WHERE id = v_product_id;

        -- Record stock movement
        INSERT INTO public.stock_movements (
            product_id,
            movement_type,
            quantity_delta,
            reference_type,
            reference_id,
            created_by
        ) VALUES (
            v_product_id,
            'RETURN',
            v_qty,
            'RETURN',
            v_return_id,
            p_user_id
        );
    END LOOP;

    -- 3. Check if all items across the sale are now fully returned
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

    -- Update sale status
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

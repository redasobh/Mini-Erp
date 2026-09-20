import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  CreditCard,
  Banknote,
  Wallet,
  ArrowRightLeft,
  FileCheck,
  Check,
  AlertCircle,
} from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { InvoiceModal } from '../components/invoice/InvoiceModal';
import type { Product, Category, CartItem, PaymentMethod, Sale, SaleItem } from '../types/app';

export const POSView: React.FC = () => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Cart states
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Checkout modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('CASH');
  const [processingSale, setProcessingSale] = useState(false);

  // Completed Invoice Modal states
  const [completedSaleModalOpen, setCompletedSaleModalOpen] = useState(false);
  const [lastCreatedSale, setLastCreatedSale] = useState<Sale | null>(null);
  const [lastCreatedItems, setLastCreatedItems] = useState<Array<SaleItem & { product_name?: string }>>([]);

  // Fetch active products and categories
  const loadData = async () => {
    try {
      setLoading(true);

      const [catRes, prodRes] = await Promise.all([
        supabase.from('categories').select('*').eq('is_active', true).order('name'),
        supabase.from('products').select('*').eq('is_active', true).order('name'),
      ]);

      if (catRes.data) setCategories(catRes.data);
      if (prodRes.data) setProducts(prodRes.data);
    } catch (err) {
      console.error('Error loading POS data:', err);
      showToast('حدث خطأ أثناء تحميل قائمة المنتجات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Add to cart
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) {
      showToast(`المنتج (${product.name}) نفد من المخزون ولا يمكن بيعه`, 'error');
      return;
    }

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product_id === product.id);

      if (existing) {
        if (existing.quantity >= product.stock_quantity) {
          showToast(`الكمية المطلوبة غير متوفرة في المخزون (المتوفر: ${product.stock_quantity})`, 'error');
          return prevCart;
        }

        return prevCart.map((item) =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total: (item.quantity + 1) * item.unit_price,
              }
            : item
        );
      }

      return [
        ...prevCart,
        {
          product_id: product.id,
          name: product.name,
          unit_price: Number(product.price),
          quantity: 1,
          available_stock: product.stock_quantity,
          total: Number(product.price),
        },
      ];
    });
  };

  // Update quantity in cart
  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;

            if (newQty > item.available_stock) {
              showToast(`الكمية المطلوبة غير متوفرة في المخزون (المتوفر: ${item.available_stock})`, 'error');
              return item;
            }

            return {
              ...item,
              quantity: newQty,
              total: newQty * item.unit_price,
            };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setDiscountAmount(0);
  };

  // Calculate totals
  const subtotal = cart.reduce((acc, item) => acc + item.total, 0);
  const validatedDiscount = Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal);
  const finalTotal = Math.max(subtotal - validatedDiscount, 0);

  // Complete sale atomic execution
  const handleConfirmSale = async () => {
    if (!user) {
      showToast('يجب تسجيل الدخول لإتمام عملية البيع', 'error');
      return;
    }

    if (cart.length === 0) {
      showToast('السلة فارغة، أضف منتجات للبدء', 'error');
      return;
    }

    setProcessingSale(true);

    try {
      // Generate clean sequential / timestamp invoice number: INV-YYYYMMDD-XXXX
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const generatedInvoiceNumber = `INV-${datePart}-${randomSuffix}`;

      // Prepare items payload for complete_sale RPC
      const rpcItems = cart.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
      }));

      // Atomic call to complete_sale function
      const { data, error } = await supabase.rpc('complete_sale', {
        p_invoice_number: generatedInvoiceNumber,
        p_user_id: user.id,
        p_items: rpcItems,
        p_payment_method: selectedPaymentMethod,
        p_discount_amount: validatedDiscount,
        p_notes: null,
      });

      if (error) {
        console.error('Sale RPC error:', error);
        showToast(error.message || 'حدث خطأ أثناء حفظ الفاتورة وتحديث المخزون', 'error');
        setProcessingSale(false);
        return;
      }

      showToast(`تم إنشاء الفاتورة رقم ${generatedInvoiceNumber} بنجاح`, 'success');

      // Setup invoice modal data
      const saleResult = data as any;
      setLastCreatedSale({
        id: saleResult?.sale_id || '',
        invoice_number: generatedInvoiceNumber,
        user_id: user.id,
        subtotal: subtotal,
        discount_amount: validatedDiscount,
        total_amount: finalTotal,
        status: 'COMPLETED',
        notes: null,
        created_at: new Date().toISOString(),
      });

      setLastCreatedItems(
        cart.map((c) => ({
          id: Math.random().toString(),
          sale_id: saleResult?.sale_id || '',
          product_id: c.product_id,
          product_name: c.name,
          quantity: c.quantity,
          unit_price: c.unit_price,
          cost_price: 0,
          total_price: c.total,
          created_at: new Date().toISOString(),
        }))
      );

      // Close checkout modal & open invoice modal
      setCheckoutModalOpen(false);
      setCompletedSaleModalOpen(true);

      // Reset cart and reload stock data
      clearCart();
      loadData();
    } catch (err: any) {
      console.error('Fatal Sale error:', err);
      showToast(err.message || 'حدث خطأ غير متوقع أثناء إتمام البيع', 'error');
    } finally {
      setProcessingSale(false);
    }
  };

  // Filter products by category and search
  const filteredProducts = products.filter((prod) => {
    const matchesCategory = selectedCategory === 'all' || prod.category_id === selectedCategory;
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return <LoadingSpinner message="جاري تجهيز نقطة البيع..." />;
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6.5rem)]">
      {/* ---------------------------------------------------- */}
      {/* RIGHT/CENTER: Catalog & Products Grid (65% width)   */}
      {/* ---------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-6 overflow-hidden">
        {/* Search and Category Filter Header */}
        <div className="space-y-4 mb-4">
          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن وجبة، مشروب، أو صنف..."
              className="w-full pl-4 pr-11 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none text-sm transition-all"
            />
            <Search className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5" />
          </div>

          {/* Categories Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              الكل ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`py-2 px-4 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <EmptyState
              title="لم يتم العثور على أي منتج"
              description="جرب البحث بكلمة أخرى أو اختر تصنيفاً آخر."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredProducts.map((product) => {
                const isOutOfStock = product.stock_quantity <= 0;
                const isLowStock = product.stock_quantity <= product.min_stock_level && !isOutOfStock;

                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={isOutOfStock}
                    className={`flex flex-col justify-between p-4 rounded-2xl border text-right transition-all group ${
                      isOutOfStock
                        ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                        : 'bg-white border-slate-200/80 hover:border-emerald-500 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]'
                    }`}
                  >
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[11px] font-medium text-slate-400">
                          {categories.find((c) => c.id === product.category_id)?.name || 'صنف'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isOutOfStock
                              ? 'bg-rose-100 text-rose-700'
                              : isLowStock
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {isOutOfStock ? 'نفد' : `متبقي: ${product.stock_quantity}`}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-800 line-clamp-2 mb-1 group-hover:text-emerald-700 transition-colors">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900 font-mono">
                        {formatCurrency(product.price)}
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* LEFT: Active Order Cart & Checkout (35% width)      */}
      {/* ---------------------------------------------------- */}
      <div className="w-full lg:w-96 bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
        {/* Cart Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-800">طلب العميل الحالي</h3>
          </div>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-rose-500 hover:text-rose-700 font-medium flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>إفراغ السلة</span>
            </button>
          )}
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <ShoppingCart className="w-12 h-12 stroke-[1.5] mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-700">السلة فارغة</p>
              <p className="text-xs text-slate-400 mt-1">اضغط على الأصناف لإضافتها إلى الطلب</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-xs text-slate-800 truncate">{item.name}</h5>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {formatCurrency(item.unit_price)} × {item.quantity}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <button
                      onClick={() => updateQuantity(item.product_id, -1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-7 text-center text-xs font-bold font-mono text-slate-800">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product_id, 1)}
                      className="w-7 h-7 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="font-mono font-bold text-xs text-slate-900 w-16 text-left">
                    {formatCurrency(item.total)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals & Checkout Actions */}
        <div className="p-5 border-t border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex justify-between text-xs text-slate-600">
            <span>المجموع الفرعي:</span>
            <span className="font-mono font-semibold">{formatCurrency(subtotal)}</span>
          </div>

          {/* Discount Field */}
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-slate-600">خصم مالي:</span>
            <div className="relative w-32">
              <input
                type="number"
                min="0"
                max={subtotal}
                step="0.5"
                value={discountAmount || ''}
                onChange={(e) => setDiscountAmount(Number(e.target.value) || 0)}
                placeholder="0.00"
                className="w-full text-left pl-2 pr-2 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
            <span>الإجمالي المستحق:</span>
            <span className="font-mono text-emerald-600 text-lg">{formatCurrency(finalTotal)}</span>
          </div>

          <button
            onClick={() => setCheckoutModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full py-4 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
          >
            <span>إتمام البيع والدفع</span>
            <span className="font-mono">({formatCurrency(finalTotal)})</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* CHECKOUT MODAL: Select Payment Method & Confirm      */}
      {/* ---------------------------------------------------- */}
      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        title="تأكيد الدفع وإصدار الفاتورة"
        maxWidth="md"
      >
        <div className="space-y-6">
          {/* Amount Summary */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
            <p className="text-xs text-slate-400 mb-1">المبلغ المطلوب سداده</p>
            <p className="text-3xl font-black text-emerald-600 font-mono">{formatCurrency(finalTotal)}</p>
          </div>

          {/* Payment Methods Grid */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              اختر طريقة الدفع:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'CASH', label: 'نقداً (كاش)', icon: <Banknote className="w-5 h-5" /> },
                { id: 'CARD', label: 'بطاقة / شبكة', icon: <CreditCard className="w-5 h-5" /> },
                { id: 'TRANSFER', label: 'تحويل بنكي', icon: <ArrowRightLeft className="w-5 h-5" /> },
                { id: 'WALLET', label: 'محفظة إلكترونية', icon: <Wallet className="w-5 h-5" /> },
                { id: 'CREDIT', label: 'على الحساب (آجل)', icon: <FileCheck className="w-5 h-5" /> },
              ].map((method) => {
                const isSelected = selectedPaymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method.id as PaymentMethod)}
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 font-bold shadow-sm'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600'
                    }`}
                  >
                    <span className={`mb-1.5 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {method.icon}
                    </span>
                    <span className="text-xs">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setCheckoutModalOpen(false)}
              disabled={processingSale}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleConfirmSale}
              disabled={processingSale}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all shadow-md shadow-emerald-600/20 disabled:bg-emerald-400 flex items-center justify-center gap-2"
            >
              {processingSale ? (
                <span>جاري معالجة الفاتورة...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>تأكيد وطباعة</span>
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* INVOICE MODAL: Post-Sale Print & Details             */}
      {/* ---------------------------------------------------- */}
      <InvoiceModal
        isOpen={completedSaleModalOpen}
        onClose={() => setCompletedSaleModalOpen(false)}
        sale={lastCreatedSale}
        items={lastCreatedItems}
        payments={
          lastCreatedSale
            ? [
                {
                  id: Math.random().toString(),
                  sale_id: lastCreatedSale.id,
                  payment_method: selectedPaymentMethod,
                  amount: lastCreatedSale.total_amount,
                  created_at: lastCreatedSale.created_at,
                },
              ]
            : []
        }
        cashierName={profile?.full_name}
      />
    </div>
  );
};

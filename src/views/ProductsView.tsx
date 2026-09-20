import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { formatCurrency } from '../lib/utils';
import { Plus, Search, Edit2, Power, UtensilsCrossed, AlertCircle } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import type { Product, Category } from '../types/app';

export const ProductsView: React.FC = () => {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
    price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock_level: '5',
    is_active: true,
  });
  const [submitting, setSubmitting] = useState(false);

  // Toggle active confirm state
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [productToToggle, setProductToToggle] = useState<Product | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        supabase.from('products').select('*').order('name'),
        supabase.from('categories').select('*').order('name'),
      ]);

      if (prodRes.data) setProducts(prodRes.data);
      if (catRes.data) setCategories(catRes.data);
    } catch (err) {
      console.error('Error loading products:', err);
      showToast('حدث خطأ أثناء تحميل المنتجات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category_id: categories[0]?.id || '',
      price: '',
      cost_price: '0',
      stock_quantity: '0',
      min_stock_level: '5',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      category_id: prod.category_id,
      price: String(prod.price),
      cost_price: String(prod.cost_price || 0),
      stock_quantity: String(prod.stock_quantity),
      min_stock_level: String(prod.min_stock_level),
      is_active: prod.is_active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast('اسم المنتج مطلوب', 'error');
      return;
    }
    if (!formData.category_id) {
      showToast('يرجى اختيار تصنيف للمنتج', 'error');
      return;
    }

    const priceNum = parseFloat(formData.price);
    const costNum = parseFloat(formData.cost_price) || 0;
    const stockNum = parseInt(formData.stock_quantity) || 0;
    const minStockNum = parseInt(formData.min_stock_level) || 0;

    if (isNaN(priceNum) || priceNum < 0) {
      showToast('سعر البيع يجب أن يكون رقماً موجباً', 'error');
      return;
    }
    if (costNum < 0 || stockNum < 0 || minStockNum < 0) {
      showToast('القيم المالية والكميات لا يمكن أن تكون سالبة', 'error');
      return;
    }

    setSubmitting(true);

    try {
      if (editingProduct) {
        // Update product
        const { error } = await supabase
          .from('products')
          .update({
            name: formData.name.trim(),
            category_id: formData.category_id,
            price: priceNum,
            cost_price: costNum,
            min_stock_level: minStockNum,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id);

        if (error) throw error;
        showToast('تم تحديث بيانات المنتج بنجاح', 'success');
      } else {
        // Add new product
        const { error } = await supabase.from('products').insert([
          {
            name: formData.name.trim(),
            category_id: formData.category_id,
            price: priceNum,
            cost_price: costNum,
            stock_quantity: stockNum,
            min_stock_level: minStockNum,
            is_active: formData.is_active,
          },
        ]);

        if (error) throw error;
        showToast('تمت إضافة المنتج الجديد بنجاح', 'success');
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      console.error('Error saving product:', err);
      showToast(err.message || 'حدث خطأ أثناء حفظ المنتج', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!productToToggle) return;

    try {
      const { error } = await supabase
        .from('products')
        .update({
          is_active: !productToToggle.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', productToToggle.id);

      if (error) throw error;

      showToast(
        productToToggle.is_active
          ? `تم تعطيل المنتج (${productToToggle.name}) بنجاح`
          : `تم تفعيل المنتج (${productToToggle.name}) بنجاح`,
        'success'
      );

      setToggleConfirmOpen(false);
      setProductToToggle(null);
      loadData();
    } catch (err: any) {
      console.error('Error toggling product:', err);
      showToast('حدث خطأ أثناء تعديل حالة المنتج', 'error');
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = categoryFilter === 'all' || p.category_id === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="py-2.5 px-3 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 outline-none"
          >
            <option value="all">كافة التصنيفات</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة منتج جديد</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner message="جاري تحميل المنتجات..." />
        ) : filteredProducts.length === 0 ? (
          <EmptyState
            title="لا توجد منتجات مسجلة"
            description="اضغط على زر (إضافة منتج جديد) لإدخال أول صنف في القائمة."
            action={{
              label: 'إضافة منتج الآن',
              onClick: openAddModal,
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="py-3.5 px-6 font-bold">اسم المنتج</th>
                  <th className="py-3.5 px-6 font-bold">التصنيف</th>
                  <th className="py-3.5 px-6 font-bold text-left">سعر البيع</th>
                  <th className="py-3.5 px-6 font-bold text-left">سعر التكلفة</th>
                  <th className="py-3.5 px-6 font-bold text-center">الرصيد الحالي</th>
                  <th className="py-3.5 px-6 font-bold text-center">الحد الأدنى</th>
                  <th className="py-3.5 px-6 font-bold text-center">الحالة</th>
                  <th className="py-3.5 px-6 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredProducts.map((prod) => {
                  const categoryName = categories.find((c) => c.id === prod.category_id)?.name || '-';
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-4 px-6 font-bold text-slate-900">{prod.name}</td>
                      <td className="py-4 px-6 text-xs text-slate-500">{categoryName}</td>
                      <td className="py-4 px-6 text-left font-mono font-bold text-slate-900">
                        {formatCurrency(prod.price)}
                      </td>
                      <td className="py-4 px-6 text-left font-mono text-xs text-slate-500">
                        {formatCurrency(prod.cost_price)}
                      </td>
                      <td className="py-4 px-6 text-center font-mono font-bold">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-lg text-xs ${
                            prod.stock_quantity <= 0
                              ? 'bg-rose-100 text-rose-700 font-black'
                              : prod.stock_quantity <= prod.min_stock_level
                              ? 'bg-amber-100 text-amber-700'
                              : 'text-slate-800'
                          }`}
                        >
                          {prod.stock_quantity}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center font-mono text-xs text-slate-400">
                        {prod.min_stock_level}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            prod.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {prod.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(prod)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="تعديل المنتج"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setProductToToggle(prod);
                              setToggleConfirmOpen(true);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              prod.is_active
                                ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
                                : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                            }`}
                            title={prod.is_active ? 'تعطيل المنتج' : 'تفعيل المنتج'}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتج *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="مثال: برجر دجاج..."
              className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف *</label>
            <select
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
              className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر البيع *</label>
              <input
                type="number"
                step="0.25"
                min="0"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0.00"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-emerald-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة</label>
              <input
                type="number"
                step="0.25"
                min="0"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="0.00"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!editingProduct && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الرصيد الافتتاحي</label>
                <input
                  type="number"
                  min="0"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })}
                  placeholder="0"
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-emerald-500 outline-none"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">حد المخزون الأدنى</label>
              <input
                type="number"
                min="0"
                value={formData.min_stock_level}
                onChange={(e) => setFormData({ ...formData, min_stock_level: e.target.value })}
                placeholder="5"
                className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:border-emerald-500 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="is_active" className="text-xs font-bold text-slate-700 cursor-pointer">
              تفعيل المنتج في قائمة البيع
            </label>
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:bg-emerald-400"
            >
              {submitting ? 'جاري الحفظ...' : 'حفظ المنتج'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toggle Confirm Dialog */}
      <ConfirmDialog
        isOpen={toggleConfirmOpen}
        onClose={() => setToggleConfirmOpen(false)}
        onConfirm={handleToggleActive}
        title={productToToggle?.is_active ? 'تعطيل المنتج' : 'تفعيل المنتج'}
        message={
          productToToggle?.is_active
            ? `هل تريد تعطيل (${productToToggle?.name})؟ لن يظهر في شاشة البيع، ولكن ستظل فواتيره القديمة محفوظة.`
            : `هل تريد إعادة تفعيل (${productToToggle?.name})؟ سيظهر مجدداً في شاشة البيع.`
        }
        confirmText={productToToggle?.is_active ? 'تعطيل' : 'تفعيل'}
        isDestructive={productToToggle?.is_active}
      />
    </div>
  );
};

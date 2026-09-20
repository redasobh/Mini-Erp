import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Plus, Search, Edit2, Power, Tags } from 'lucide-react';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EmptyState } from '../components/common/EmptyState';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import type { Category } from '../types/app';

export const CategoriesView: React.FC = () => {
  const { showToast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Toggle Confirm
  const [toggleConfirmOpen, setToggleConfirmOpen] = useState(false);
  const [categoryToToggle, setCategoryToToggle] = useState<Category | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (!error && data) {
        setCategories(data);
      }
    } catch (err) {
      console.error('Error loading categories:', err);
      showToast('حدث خطأ أثناء تحميل التصنيفات', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const openAddModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryActive(true);
    setModalOpen(true);
  };

  const openEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryActive(cat.is_active);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      showToast('اسم التصنيف مطلوب', 'error');
      return;
    }

    setSubmitting(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryName.trim(),
            is_active: categoryActive,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingCategory.id);

        if (error) {
          if (error.code === '23505') {
            showToast('لا يمكن تكرار اسم التصنيف، هذا الاسم موجود بالفعل', 'error');
            return;
          }
          throw error;
        }
        showToast('تم تعديل التصنيف بنجاح', 'success');
      } else {
        const { error } = await supabase.from('categories').insert([
          {
            name: categoryName.trim(),
            is_active: categoryActive,
          },
        ]);

        if (error) {
          if (error.code === '23505') {
            showToast('هذا التصنيف مسجل مسبقاً', 'error');
            return;
          }
          throw error;
        }
        showToast('تمت إضافة التصنيف بنجاح', 'success');
      }

      setModalOpen(false);
      loadCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      showToast('حدث خطأ أثناء حفظ التصنيف', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!categoryToToggle) return;

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          is_active: !categoryToToggle.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', categoryToToggle.id);

      if (error) throw error;

      showToast(
        categoryToToggle.is_active
          ? `تم تعطيل التصنيف (${categoryToToggle.name}) بنجاح`
          : `تم تفعيل التصنيف (${categoryToToggle.name}) بنجاح`,
        'success'
      );

      setToggleConfirmOpen(false);
      setCategoryToToggle(null);
      loadCategories();
    } catch (err: any) {
      console.error('Error toggling category:', err);
      showToast('حدث خطأ أثناء تعديل حالة التصنيف', 'error');
    }
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-4 sm:p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن تصنيف..."
            className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:border-emerald-500 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
        </div>

        <button
          onClick={openAddModal}
          className="w-full sm:w-auto flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة تصنيف جديد</span>
        </button>
      </div>

      {/* Categories Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <LoadingSpinner message="جاري تحميل التصنيفات..." />
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            title="لا توجد تصنيفات مسجلة"
            description="أضف تصنيفات مثل: وجبات، مشروبات، حلويات لتنظيم قائمة المطعم."
            action={{
              label: 'إضافة تصنيف الآن',
              onClick: openAddModal,
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50/75 border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="py-3.5 px-6 font-bold">اسم التصنيف</th>
                  <th className="py-3.5 px-6 font-bold text-center">الحالة</th>
                  <th className="py-3.5 px-6 font-bold text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCategories.map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-6 font-bold text-slate-900">{cat.name}</td>
                    <td className="py-4 px-6 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          cat.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {cat.is_active ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openEditModal(cat)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          title="تعديل التصنيف"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setCategoryToToggle(cat);
                            setToggleConfirmOpen(true);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            cat.is_active
                              ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={cat.is_active ? 'تعطيل التصنيف' : 'تفعيل التصنيف'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingCategory ? 'تعديل التصنيف' : 'إضافة تصنيف جديد'}
        maxWidth="sm"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم التصنيف *</label>
            <input
              type="text"
              required
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              placeholder="مثال: مشروبات ساخنة..."
              className="w-full p-2.5 rounded-xl border border-slate-200 text-sm focus:border-emerald-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="cat_active"
              checked={categoryActive}
              onChange={(e) => setCategoryActive(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
            />
            <label htmlFor="cat_active" className="text-xs font-bold text-slate-700 cursor-pointer">
              تصنيف نشط في القائمة
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
              {submitting ? 'جاري الحفظ...' : 'حفظ'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toggle Confirm Dialog */}
      <ConfirmDialog
        isOpen={toggleConfirmOpen}
        onClose={() => setToggleConfirmOpen(false)}
        onConfirm={handleToggleActive}
        title={categoryToToggle?.is_active ? 'تعطيل التصنيف' : 'تفعيل التصنيف'}
        message={
          categoryToToggle?.is_active
            ? `هل تريد تعطيل التصنيف (${categoryToToggle?.name})؟ لن تظهر منتجاته في شاشة البيع.`
            : `هل تريد تفعيل التصنيف (${categoryToToggle?.name})؟`
        }
        confirmText={categoryToToggle?.is_active ? 'تعطيل' : 'تفعيل'}
        isDestructive={categoryToToggle?.is_active}
      />
    </div>
  );
};

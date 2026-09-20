# Mini ERP Restaurant System — Phase 2 Documentation

دليل توثيق وتشغيل نظام **Mini ERP Restaurant System** (المرحلة الثانية: Supabase Database + System Connection).

---

## 📌 نظرة عامة على المشروع (Project Overview)

نظام Mini ERP لإدارة المطاعم، صُمم ليكون بسيطاً، سريعاً، وقابلاً للتوسع دون تعقيد أنظمة الـ ERP التقليدية.

* **المصادقة:** Supabase Auth (`auth.users`) مدمج مع ملفات المستخدمين (`public.users`).
* **قاعدة البيانات:** PostgreSQL مدارة عبر Supabase.
* **الأمان:** تفعيل سياسات Row Level Security (RLS) بالكامل وفصل صارم بين صلاحيات المدير (`admin`) والكاشير (`agent`).
* **سلامة البيانات:** دوال ذرية (Atomic Functions) لإتمام المبيعات ومعالجة المرتجعات مع قفل الأسطر ومنع التلاعب بالمخزون.

---

## 🗄️ هيكل قاعدة البيانات (Database Schema)

يتكون النظام من 10 جداول رئيسية:

1. **`roles`:** جدول الأدوار (`admin`, `agent`).
2. **`users`:** ملفات المستخدمين وربطها التلقائي بحسابات `auth.users`.
3. **`categories`:** تصنيفات القائمة (`Meals`, `Drinks`, `Desserts`...).
4. **`products`:** المنتجات، الأسعار، التكلفة، رصيد المخزون، والحد الأدنى.
5. **`sales`:** رأس فواتير البيع وتوليد رقم فاتورة فريد (`invoice_number`).
6. **`sale_items`:** بنود الفاتورة مع تثبيت سعر وتكلفة الشراء لحظة البيع (Price Snapshot).
7. **`payments`:** طرق المدفوعات (`CASH`, `CARD`, `TRANSFER`, `WALLET`, `CREDIT`) جاهزة للـ Split Payment.
8. **`returns`:** رأس المرتجع والمرتبط حصراً بفاتورة أصلية.
9. **`return_items`:** بنود المرتجع مع التحقق من عدم تجاوز الكمية المباعة.
10. **`stock_movements`:** سجل تدقيق تاريخي غير قابل للتعديل لكل حركة مخزون (`SALE`, `RETURN`, `ADJUSTMENT_IN`, `ADJUSTMENT_OUT`, `INITIAL`).

---

## ⚙️ الدوال الذرية (Atomic Functions)

تم تضمين إجراءين مخزنين بصفة `SECURITY DEFINER` لمنع التلاعب من الواجهة:

### 1. `complete_sale`
تقوم بتنفيذ العملية المالية كاملة كعملية ذرية واحدة (تنجح كلها أو تفشل كلها):
* قفل أسطر المنتجات وفحص توفر الرصيد ونشاط المنتج.
* إنشاء سجل الفاتورة `sales`.
* إنشاء بنود الفاتورة `sale_items` بأسعار البيع اللحظية.
* خصم الكمية من `products.stock_quantity`.
* إنشاء حركة مخزون تلقائية في `stock_movements` (نوع `SALE`).
* تسجيل الدفعة في `payments`.

### 2. `process_return`
معالجة إرجاع منضبطة تضمن:
* التحقق من وجود الفاتورة الأصلية وعدم إلغائها.
* التحقق من أن:
  $$\text{Returned Quantity} \le \text{Sold Quantity} - \text{Previously Returned Quantity}$$
* إنشاء سجل المرتجع `returns` وبنوده `return_items`.
* إعادة الكميات للمخزون وتسجيل حركة `stock_movements` (نوع `RETURN`).
* تحديث حالة الفاتورة تلقائياً إلى `RETURNED_PARTIAL` أو `RETURNED_FULL`.

---

## 🚀 طريقة التشغيل والربط مع Supabase (Step-by-Step Setup)

### الخطوة 1: تطبيق الـ Migrations في Supabase
1. افتح لوحة تحكم مشروعك في [Supabase](https://supabase.com).
2. ادخل إلى **SQL Editor**.
3. افتح ملف [`supabase/full_schema_migration.sql`](file:///C:/Users/Administrator/.gemini/antigravity/scratch/mini-erp/supabase/full_schema_migration.sql).
4. انسخ المحتوى والصقه بالكامل، ثم اضغط **RUN**.
*(سيتم إنشاء كافة الجداول، الفهارس، السياسات RLS، الدوال الذرية، والبيانات التجريبية تلقائياً).*

### الخطوة 2: ضبط متغيرات البيئة (Environment Variables)
1. انسخ ملف `.env.example` إلى `.env`:
   ```bash
   cp .env.example .env
   ```
2. ضع رابط مشروعك والمفتاح العام (Anon Key):
   ```env
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-actual-anon-key
   ```
> ⚠️ **تنبيه أمني هام:** لا تضع أبداً `service_role key` داخل ملف `.env` الخاص بالتطبيق.

### الخطوة 3: تثبيت الحزم وتشغيل فحص الاتصال
```bash
npm install
npm run test:connection
```

---

## 🔒 سياسات الأمان (Row Level Security - RLS)

* **المدير (Admin):**
  * صلاحيات كاملة لإدارة الأصناف، الأسعار، التصنيفات، والمستخدمين.
  * استعراض سجل حركات المخزون والتقارير.
* **الكاشير (Agent):**
  * قراءة المنتجات والتصنيفات النشطة فقط.
  * إنشاء المبيعات والمرتجعات النظامية.
  * **ممنوع تماماً من:** تعديل الأسعار، حذف المنتجات، إدارة المستخدمين، أو تعديل المخزون يدوياً.

---

## 📁 هيكل المجلدات (Folder Structure)

```text
mini-erp/
├── README.md                           # هذا الملف التوثيقي
├── package.json                        # إعدادات الحزم
├── .env.example                        # نموذج إعدادات الاتصال
├── scripts/
│   └── verify_supabase.mjs             # سكربت الفحص الآلي
├── src/
│   ├── lib/
│   │   └── supabaseClient.ts           # عميل Supabase الموحد
│   └── types/
│       └── database.ts                 # أنواع TypeScript لقاعدة البيانات
└── supabase/
    ├── full_schema_migration.sql       # ملف التهجير الكامل المجمع
    └── migrations/                     # ملفات التهجير الفردية (001 - 013)
```

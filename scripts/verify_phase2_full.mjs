import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env
const envPath = path.resolve(process.cwd(), '.env');
let url = process.env.VITE_SUPABASE_URL;
let anonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
      url = trimmed.split('=')[1].trim();
    }
    if (trimmed.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      anonKey = trimmed.split('=')[1].trim();
    }
  }
}

console.log('--- Phase 2 Full Verification Script ---');
console.log('Supabase URL:', url);
console.log('Anon Key Present:', !!anonKey && !anonKey.includes('your-'));

if (!url || !anonKey) {
  console.error('FAIL: Missing credentials in .env');
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function verify() {
  const results = {};

  // 1. Connection & Tables Check
  const tables = [
    'roles',
    'users',
    'categories',
    'products',
    'sales',
    'sale_items',
    'payments',
    'returns',
    'return_items',
    'stock_movements'
  ];

  console.log('\n--- Checking Tables & Connection ---');
  let allTablesFound = true;
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table [${table}]: ERROR ->`, error.message);
      allTablesFound = false;
      results[table] = { status: 'FAIL', error: error.message };
    } else {
      console.log(`Table [${table}]: OK (Found)`);
      results[table] = { status: 'PASS' };
    }
  }

  // 2. Seed Data Check (roles, categories, products)
  console.log('\n--- Checking Seed Data ---');
  const { data: roles } = await supabase.from('roles').select('*');
  console.log('Roles:', roles);

  const { data: categories } = await supabase.from('categories').select('*');
  console.log('Categories count:', categories?.length);

  const { data: products } = await supabase.from('products').select('*');
  console.log('Products count:', products?.length);

  // 3. Check RPC Functions
  console.log('\n--- Checking RPC Functions (complete_sale & process_return) ---');
  const probeSale = await supabase.rpc('complete_sale', {
    p_invoice_number: 'TEST-PROBE-' + Date.now(),
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_items: [],
    p_payment_method: 'CASH',
  });
  console.log('complete_sale probe response:', probeSale.error ? probeSale.error.message : probeSale.data);

  const probeReturn = await supabase.rpc('process_return', {
    p_return_number: 'TEST-RET-' + Date.now(),
    p_sale_id: '00000000-0000-0000-0000-000000000000',
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_items: [],
    p_refund_method: 'CASH',
  });
  console.log('process_return probe response:', probeReturn.error ? probeReturn.error.message : probeReturn.data);

  // 4. Return summary
  console.log('\nVerification run finished.');
}

verify().catch(e => {
  console.error('Fatal Verification Error:', e);
});

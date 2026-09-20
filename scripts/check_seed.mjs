import { createClient } from '@supabase/supabase-js';

const url = 'https://dampitciubylempycogp.supabase.co';
const anonKey = 'sb_publishable_qg3STNNVAQi00Eun04TVuA_o7tToxjo';

const supabase = createClient(url, anonKey);

async function checkSeedAndDetails() {
  console.log('Checking details...');

  const { data: roles, error: rErr } = await supabase.from('roles').select('*');
  console.log('Roles data:', roles, 'Error:', rErr);

  const { data: cat, error: cErr } = await supabase.from('categories').select('*');
  console.log('Categories data:', cat, 'Error:', cErr);

  const { data: prod, error: pErr } = await supabase.from('products').select('*');
  console.log('Products data:', prod, 'Error:', pErr);

  // If empty, let's see if we can insert seed data via anon if permitted or if it needs to be inserted
  if (roles && roles.length === 0) {
    console.log('Attempting to seed roles...');
    const { data: rIns, error: rInsErr } = await supabase.from('roles').insert([
      { name: 'admin', description: 'Administrator' },
      { name: 'agent', description: 'Cashier Agent' }
    ]).select();
    console.log('Roles insert result:', rIns, 'Error:', rInsErr);
  }
}

checkSeedAndDetails().catch(console.error);

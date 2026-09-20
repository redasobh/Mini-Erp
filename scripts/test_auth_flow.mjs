import { createClient } from '@supabase/supabase-js';

const url = 'https://dampitciubylempycogp.supabase.co';
const anonKey = 'sb_publishable_qg3STNNVAQi00Eun04TVuA_o7tToxjo';

const supabase = createClient(url, anonKey);

async function testAuthAndPermissions() {
  console.log('--- Testing Supabase Auth & Permissions ---');

  const testEmail = `test_agent_${Date.now()}@example.com`;
  const testPassword = 'Password123!@#';

  console.log(`1. Attempting signUp with ${testEmail}...`);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: testEmail,
    password: testPassword,
    options: {
      data: {
        full_name: 'Test Agent',
        role: 'agent'
      }
    }
  });

  if (signUpError) {
    console.error('SignUp Error:', signUpError.message);
  } else {
    console.log('SignUp Success! User ID:', signUpData.user?.id);
    console.log('Session present:', !!signUpData.session);

    // If session is present, let's test queries as authenticated user
    if (signUpData.session) {
      console.log('\n2. Testing queries as authenticated user:');
      const { data: rolesData, error: rolesErr } = await supabase.from('roles').select('*');
      console.log('roles query:', rolesErr ? rolesErr.message : rolesData);

      const { data: productsData, error: prodErr } = await supabase.from('products').select('*');
      console.log('products query:', prodErr ? prodErr.message : productsData);

      const { data: catData, error: catErr } = await supabase.from('categories').select('*');
      console.log('categories query:', catErr ? catErr.message : catData);

      const { data: userData, error: userErr } = await supabase.from('users').select('*');
      console.log('users query:', userErr ? userErr.message : userData);
    }
  }
}

testAuthAndPermissions().catch(console.error);

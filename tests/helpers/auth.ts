import { createClient, type User } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export async function authenticatedClient(user: User) { const client = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { autoRefreshToken: false, persistSession: false } }); const result = await client.auth.signInWithPassword({ email: user.email!, password: 'RaceDeck-test-123!' }); if (result.error) throw result.error; return client; }

import { createClient } from '@supabase/supabase-js';

// Somente a chave PÚBLICA (publishable/anon) é usada aqui. A segurança dos dados
// vem das políticas RLS do banco. Nunca coloque a service_role/secret key no frontend.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && key && url.startsWith('http'));

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'not-configured', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export const PHOTOS_BUCKET = 'progress-photos';

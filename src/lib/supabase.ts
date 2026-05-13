import { createClient } from "@supabase/supabase-js";

// Prerender sırasında env yoksa build düşmesin diye placeholder.
// Gerçek değerler Vercel'da NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY olarak ayarlanır.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type StoredData = {
  profiles: unknown[];
  totalWorkdays: number;
  senderName: string;
  companyName: string;
  periodMonth: number;
  periodYear: number;
};

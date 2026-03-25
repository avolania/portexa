import { createClient } from "@supabase/supabase-js";

// Yalnızca server-side API route'larında kullanın (service_role key RLS'yi bypass eder)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

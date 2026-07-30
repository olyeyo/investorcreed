import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  // Don't throw — this also runs during `vite build` on Vercel before env
  // vars are checked, and a hard crash here is harder to debug than a
  // console warning + broken sign-in screen.
  console.error(
    "Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in .env.local for local dev, " +
      "and in your Vercel project's Settings → Environment Variables for production."
  );
}

export const supabase = createClient(url, anonKey);

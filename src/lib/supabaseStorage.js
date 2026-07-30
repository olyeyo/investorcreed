import { supabase } from "./supabaseClient.js";

// Implements the same interface App.jsx already calls via window.storage,
// so the app code needs zero changes — only the backend underneath it does.
// Every row in kv_store is scoped to the signed-in user (see
// supabase/schema.sql for the RLS policy that enforces this server-side too).

async function currentUserId() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

export const supabaseStorage = {
  async get(key, shared = false) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("kv_store")
      .select("value")
      .eq("user_id", userId)
      .eq("key", key)
      .eq("shared", shared)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error(`No value found for key "${key}"`);
    return { key, value: data.value, shared };
  },

  async set(key, value, shared = false) {
    const userId = await currentUserId();
    const { error } = await supabase.from("kv_store").upsert(
      { user_id: userId, key, value, shared, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key,shared" }
    );
    if (error) throw error;
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const userId = await currentUserId();
    const { error } = await supabase
      .from("kv_store")
      .delete()
      .eq("user_id", userId)
      .eq("key", key)
      .eq("shared", shared);
    if (error) throw error;
    return { key, deleted: true, shared };
  },

  async list(prefix = "", shared = false) {
    const userId = await currentUserId();
    const { data, error } = await supabase
      .from("kv_store")
      .select("key")
      .eq("user_id", userId)
      .eq("shared", shared)
      .like("key", `${prefix}%`);
    if (error) throw error;
    return { keys: (data || []).map((r) => r.key), prefix, shared };
  },
};

if (typeof window !== "undefined") {
  window.storage = supabaseStorage;
}

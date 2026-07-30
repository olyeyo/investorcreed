import { supabase } from "./supabaseClient.js";

async function uid() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

// ---------- contacts (pipeline) ----------

function toDbContact(c, userId) {
  const row = {
    name: c.name,
    company: c.company || "",
    country: c.country || "",
    platform: c.platform || "Other",
    handle: c.handle || "",
    type: c.type || "Founder",
    stage_focus: c.stageFocus || "N/A",
    status: c.status || "Not contacted",
    last_contact: c.lastContact || null,
    next_follow_up: c.nextFollowUp || null,
    notes: c.notes || "",
  };
  if (userId) row.user_id = userId;
  return row;
}

function fromDbContact(r) {
  return {
    id: r.id,
    name: r.name,
    company: r.company || "",
    country: r.country || "",
    platform: r.platform || "Other",
    handle: r.handle || "",
    type: r.type || "Founder",
    stageFocus: r.stage_focus || "N/A",
    status: r.status || "Not contacted",
    lastContact: r.last_contact || "",
    nextFollowUp: r.next_follow_up || "",
    notes: r.notes || "",
    createdAt: r.created_at,
  };
}

export async function fetchContacts() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []).map(fromDbContact);
}

export async function insertContact(c) {
  const userId = await uid();
  const { data, error } = await supabase
    .from("contacts")
    .insert(toDbContact(c, userId))
    .select()
    .single();
  if (error) throw error;
  return fromDbContact(data);
}

export async function insertContacts(list) {
  const userId = await uid();
  const { error } = await supabase.from("contacts").insert(list.map((c) => toDbContact(c, userId)));
  if (error) throw error;
}

export async function updateContact(c) {
  const { error } = await supabase.from("contacts").update(toDbContact(c)).eq("id", c.id);
  if (error) throw error;
}

export async function deleteContactRow(id) {
  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) throw error;
}

// ---------- seed flag (tiny, still backed by kv_store) ----------

export async function hasSeeded() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("kv_store")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "seeded-v1")
    .eq("shared", false)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export async function markSeeded() {
  const userId = await uid();
  const { error } = await supabase
    .from("kv_store")
    .upsert(
      { user_id: userId, key: "seeded-v1", value: "true", shared: false, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key,shared" }
    );
  if (error) throw error;
}

// ---------- directory (batches + investor rows) ----------

export async function fetchBatches() {
  const userId = await uid();
  const { data, error } = await supabase
    .from("directory_batches")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function importBatch(name, records) {
  const userId = await uid();
  const { data: batch, error: bErr } = await supabase
    .from("directory_batches")
    .insert({ user_id: userId, name, row_count: records.length })
    .select()
    .single();
  if (bErr) throw bErr;

  const payload = records.map((r) => ({
    batch_id: batch.id,
    user_id: userId,
    name: r.name,
    raw_type: r.rawType || "",
    city: r.city || "",
    country: r.country || "",
    website: r.website || "",
    linkedin: r.linkedin || "",
    email: r.email || "",
    stages: r.stages || "",
    industry_focus: r.industryFocus || "",
    geo_focus: r.geoFocus || "",
    min_investment: r.minInvestment || 0,
    max_investment: r.maxInvestment || 0,
    notes: r.notes || "",
  }));

  // Insert in chunks — keeps each request small and lets us report progress
  // for large spreadsheets instead of one multi-thousand-row request.
  const chunkSize = 500;
  for (let i = 0; i < payload.length; i += chunkSize) {
    const { error } = await supabase.from("directory_investors").insert(payload.slice(i, i + chunkSize));
    if (error) throw error;
  }

  return batch;
}

export async function deleteBatch(id) {
  // directory_investors rows cascade-delete via the FK.
  const { error } = await supabase.from("directory_batches").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchInvestors(batchIds) {
  const userId = await uid();
  let q = supabase.from("directory_investors").select("*").eq("user_id", userId);
  if (batchIds && batchIds.length > 0) q = q.in("batch_id", batchIds);
  const { data, error } = await q.limit(6000);
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    batchId: r.batch_id,
    name: r.name,
    rawType: r.raw_type || "",
    city: r.city || "",
    country: r.country || "",
    website: r.website || "",
    linkedin: r.linkedin || "",
    email: r.email || "",
    stages: r.stages || "",
    industryFocus: r.industry_focus || "",
    geoFocus: r.geo_focus || "",
    minInvestment: Number(r.min_investment) || 0,
    maxInvestment: Number(r.max_investment) || 0,
    notes: r.notes || "",
  }));
}

import { createClient } from "@supabase/supabase-js";

let client;

// Server-only client: uses the service role key, so never send it to the browser.
export function adminClient() {
  if (!client) {
    client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function userFromRequest(req) {
  const token = req.headers["x-supabase-auth"];
  if (!token) return null;
  const { data, error } = await adminClient().auth.getUser(token);
  return error ? null : data.user;
}

export async function sittersBookedOn(date) {
  const { data, error } = await adminClient()
    .from("bookings")
    .select("sitter")
    .eq("booking_date", date);
  if (error) throw error;
  return data.map((row) => row.sitter);
}

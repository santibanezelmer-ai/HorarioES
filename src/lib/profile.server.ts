import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

async function verifyAccessToken(accessToken: string): Promise<string> {
  if (!accessToken || typeof accessToken !== "string") {
    throw new Error("Invalid session");
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://sxadthmnijgitmxpdjbu.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_MDd9pxsQKfVCB0j2nUcFtQ_2V7QYOo-';

  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getClaims(accessToken);
  if (error || !data?.claims?.sub) {
    throw new Error("Invalid session");
  }
  return data.claims.sub as string;
}

export async function getProfileForAccessToken(accessToken: string) {
  const userId = await verifyAccessToken(accessToken);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, user_id, display_name, email, avatar_url, colegio_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

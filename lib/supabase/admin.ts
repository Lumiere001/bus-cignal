import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * service_role 클라이언트 — RLS 우회. **서버 전용** (마스터 작업·시스템 cron).
 * 절대 클라이언트 컴포넌트에서 import 하지 말 것.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

import { requireOperator } from "@/lib/auth/operator";
import { createAdminClient } from "@/lib/supabase/admin";
import { one } from "@/lib/supabase/relation";
import { LocationManager, type RegionLocation } from "./LocationManager";

export const dynamic = "force-dynamic";

// 간사 내 정보 (SPEC §4.3·§2.2) — 이름·전화는 CCC 동기화(읽기). 소속 지구 변경=마스터 재승인.

const APPROVAL_LABEL: Record<string, string> = {
  pending: "승인 대기",
  approved: "활성",
  rejected: "거절됨",
  revoked: "권한 해제됨",
};

type Profile = {
  name: string | null;
  phone: string | null;
  approval_status: string;
  region: { name: string } | null;
};

async function loadProfile(operatorId: string): Promise<Profile | null> {
  const db = createAdminClient();
  const { data } = await db
    .from("operators")
    .select("name, phone, approval_status, region:regions!operators_region_id_fkey(name)")
    .eq("id", operatorId)
    .maybeSingle();
  return (data as Profile | null) ?? null;
}

async function loadLocations(regionId: string): Promise<RegionLocation[]> {
  const db = createAdminClient();
  const { data } = await db
    .from("region_locations")
    .select("id, direction, location_type, address, label, lat, lng")
    .eq("region_id", regionId)
    .order("direction", { ascending: true })
    .order("location_type", { ascending: true })
    .order("created_at", { ascending: true });
  return (data as RegionLocation[] | null) ?? [];
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b py-3 last:border-0">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function OperatorProfilePage() {
  const session = await requireOperator();
  const p = await loadProfile(session.operatorId);
  const locations = session.regionId ? await loadLocations(session.regionId) : [];

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">내 정보</h1>
        <p className="text-muted-foreground mt-1 text-sm">CCC 로그인 정보 (이름·전화는 CCC 동기화)</p>
      </div>

      {!p ? (
        <p className="text-muted-foreground text-sm">정보를 불러올 수 없습니다.</p>
      ) : (
        <dl className="rounded-xl border px-4">
          <Field label="이름" value={p.name ?? "—"} />
          <Field label="연락처" value={p.phone ?? "—"} />
          <Field label="소속 지구" value={one(p.region)?.name ?? "미배정"} />
          <Field label="권한 상태" value={APPROVAL_LABEL[p.approval_status] ?? p.approval_status} />
        </dl>
      )}

      <p className="text-muted-foreground text-xs">
        ※ 이름·연락처는 CCC 계정과 동기화됩니다. 소속 지구 변경은 마스터 재승인이 필요합니다.
      </p>

      {session.regionId && <LocationManager locations={locations} />}
    </main>
  );
}

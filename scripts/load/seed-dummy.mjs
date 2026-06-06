import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SERVICE_KEY, assertLocal, arg } from "./_env.mjs";

// 부하·QA용 더미데이터 생성기 (로컬 전용).
//   node scripts/load/seed-dummy.mjs --students 2000 --regions 15
//   node scripts/load/seed-dummy.mjs --wipe        # 이전 더미만 삭제
// 마커: operators.ccc_id LIKE 'load-%', trips.note LIKE '[LOAD]%', region_locations.label LIKE '[LOAD]%'

assertLocal();
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STUDENTS = Number(arg("students", 2000));
const REGIONS = arg("regions", "all"); // 기본 = 전체 지구(53). --regions N 으로 제한 가능.
const WIPE = !!arg("wipe", false);

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const code = () =>
  "BUS-" + Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[rand(30)]).join("");

async function insertChunked(table, rows, size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) throw new Error(`${table} insert 실패: ${error.message}`);
  }
}
async function idsIn(table, col, values, select = "id") {
  const out = [];
  for (let i = 0; i < values.length; i += 300) {
    const { data } = await db.from(table).select(select).in(col, values.slice(i, i + 300));
    out.push(...(data ?? []));
  }
  return out;
}

async function wipe() {
  console.log("🧹 이전 더미 삭제 중…");
  const ops = (await db.from("operators").select("id").like("ccc_id", "load-%")).data ?? [];
  const opIds = ops.map((o) => o.id);
  const trips = (await db.from("trips").select("id").like("note", "[LOAD]%")).data ?? [];
  const tripIds = trips.map((t) => t.id);
  if (tripIds.length) {
    const matches = await idsIn("matches", "trip_id", tripIds);
    const mIds = matches.map((m) => m.id);
    for (let i = 0; i < mIds.length; i += 300)
      await db.from("match_passengers").delete().in("match_id", mIds.slice(i, i + 300));
    for (let i = 0; i < tripIds.length; i += 300)
      await db.from("matches").delete().in("trip_id", tripIds.slice(i, i + 300));
    const reqs = await idsIn("seat_requests", "trip_id", tripIds);
    const rIds = reqs.map((r) => r.id);
    for (let i = 0; i < rIds.length; i += 300)
      await db.from("request_passengers").delete().in("request_id", rIds.slice(i, i + 300));
    for (let i = 0; i < tripIds.length; i += 300) {
      await db.from("seat_requests").delete().in("trip_id", tripIds.slice(i, i + 300));
      await db.from("seat_offers").delete().in("trip_id", tripIds.slice(i, i + 300));
    }
    for (let i = 0; i < tripIds.length; i += 300)
      await db.from("trips").delete().in("id", tripIds.slice(i, i + 300));
  }
  await db.from("region_locations").delete().like("label", "[LOAD]%");
  if (opIds.length)
    for (let i = 0; i < opIds.length; i += 300)
      await db.from("operators").delete().in("id", opIds.slice(i, i + 300));
  console.log(`   삭제: 간사 ${opIds.length} · trip ${tripIds.length}`);
}

async function main() {
  await wipe();
  if (WIPE) return console.log("✅ wipe 완료.");

  let rq = db.from("regions").select("id, code, name").order("code");
  if (REGIONS !== "all" && REGIONS !== true) rq = rq.limit(Number(REGIONS));
  const { data: regions } = await rq;
  if (!regions?.length) throw new Error("regions 없음 — supabase db reset 먼저");
  console.log(`🌱 더미 생성: 지구 ${regions.length} · 목표 학생 ${STUDENTS}`);

  // 1) 간사: 지구별 공급·수요 각 1
  const operators = [];
  const supplyOf = {}, demandOf = {};
  for (const r of regions) {
    const sup = randomUUID(), dem = randomUUID();
    supplyOf[r.id] = sup; demandOf[r.id] = dem;
    operators.push(
      { id: sup, region_id: r.id, ccc_id: `load-sup-${r.code}`, name: `[LOAD]${r.name}공급`, approval_status: "approved", role: "operator" },
      { id: dem, region_id: r.id, ccc_id: `load-dem-${r.code}`, name: `[LOAD]${r.name}수요`, approval_status: "approved", role: "operator" },
    );
  }
  await insertChunked("operators", operators);

  // 2) region_locations: 지구별 출발/도착 (created_by=공급 간사)
  const locs = [], originOf = {}, destOf = {};
  for (const r of regions) {
    const o = randomUUID(), d = randomUUID();
    originOf[r.id] = o; destOf[r.id] = d;
    locs.push(
      { id: o, region_id: r.id, direction: "down", location_type: "origin", address: `[LOAD] ${r.name} 출발`, label: `[LOAD]${r.name}출발`, lat: 36 + Math.random(), lng: 127 + Math.random(), is_default: true, created_by: supplyOf[r.id] },
      { id: d, region_id: r.id, direction: "down", location_type: "destination", address: `[LOAD] ${r.name} 도착`, label: `[LOAD]${r.name}도착`, lat: 36 + Math.random(), lng: 127 + Math.random(), is_default: true, created_by: supplyOf[r.id] },
    );
  }
  await insertChunked("region_locations", locs);

  // 3) trips(공급별 2) + offers
  const trips = [], offers = [], tripIds = [];
  for (const r of regions) {
    for (let k = 0; k < 2; k++) {
      const id = randomUUID();
      tripIds.push(id);
      trips.push({ id, operator_region_id: r.id, direction: "down", origin_location_id: originOf[r.id], destination_location_id: destOf[r.id], departure_at: new Date(Date.now() + (20 + rand(40)) * 864e5).toISOString(), capacity: 44, price_per_seat: 30000 + rand(10) * 1000, note: `[LOAD] ${r.name} 차량 ${k + 1}`, status: "published", created_by: supplyOf[r.id] });
      offers.push({ id: randomUUID(), trip_id: id, seat_count: 20, status: "open" });
    }
  }
  await insertChunked("trips", trips);
  await insertChunked("seat_offers", offers);

  // 4) 신청 + 학생 (목표 인원까지 분산)
  const requests = [], passengers = [];
  let made = 0;
  while (made < STUDENTS) {
    const r = pick(regions);
    const reqId = randomUUID();
    const n = Math.min(1 + rand(4), STUDENTS - made);
    requests.push({ id: reqId, trip_id: pick(tripIds), region_id: r.id, operator_id: demandOf[r.id], seat_count: n, status: "queued", consent_confirmed_at: new Date().toISOString(), consent_confirmed_by: demandOf[r.id], requested_at: new Date(Date.now() - rand(72) * 36e5).toISOString() });
    for (let i = 0; i < n; i++)
      passengers.push({ id: randomUUID(), request_id: reqId, name: `학생${made + i + 1}`, phone: `010-${String(1000 + rand(9000))}-${String(1000 + rand(9000))}`, school_or_role: "더미대", priority: i + 1 });
    made += n;
  }
  await insertChunked("seat_requests", requests);
  await insertChunked("request_passengers", passengers);

  // 5) ~40% 신청 → paid 매칭 + 예약번호 + match_passengers (학생 /me·/r·정산용)
  const matches = [], mpax = [], matchedReqIds = [], usedCodes = new Set();
  const paidReqs = requests.filter(() => Math.random() < 0.4);
  for (const req of paidReqs) {
    const pax = passengers.find((p) => p.request_id === req.id);
    if (!pax) continue;
    let c = code(); while (usedCodes.has(c)) c = code(); usedCodes.add(c);
    const mId = randomUUID();
    matches.push({ id: mId, trip_id: req.trip_id, request_id: req.id, passenger_id: pax.id, status: "paid", payment_reported_at: new Date(Date.now() - 36e5).toISOString(), paid_at: new Date(Date.now() - 18e5).toISOString(), reservation_code: c });
    mpax.push({ match_id: mId, name: pax.name, phone: pax.phone, school_or_role: pax.school_or_role });
    matchedReqIds.push(req.id);
  }
  await insertChunked("matches", matches);
  await insertChunked("match_passengers", mpax);
  for (let i = 0; i < matchedReqIds.length; i += 300)
    await db.from("seat_requests").update({ status: "matched" }).in("id", matchedReqIds.slice(i, i + 300));

  console.log("✅ 완료:");
  console.log(`   간사 ${operators.length} · trip ${trips.length} · 신청 ${requests.length} · 학생 ${passengers.length} · paid 예약 ${matches.length}`);
  console.log("   QA 샘플 예약번호(학생 /r):");
  matches.slice(0, 5).forEach((m, i) => console.log(`     ${m.reservation_code}  (이름=${mpax[i].name}, 끝4=${mpax[i].phone.slice(-4)})`));
}

main().catch((e) => { console.error("❌", e.message); process.exit(1); });

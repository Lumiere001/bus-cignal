import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SERVICE_KEY, assertLocal, arg } from "./_env.mjs";

// 부하·QA용 더미데이터 생성기 (로컬 전용) — 현실적 시나리오.
//   node scripts/load/seed-dummy.mjs --students 1000 --regions 20
//   node scripts/load/seed-dummy.mjs --wipe        # 이전 더미만 삭제
//
// 현실 모델 (2026-06 합의):
//   - 지구당 간사 1명(공급·수요 통합).
//   - 모든 버스는 지구↔평창. 상행=지구→평창(up), 하행=평창→지구(down). 자기지구 루프 없음.
//   - 평창 안에서도 지구마다 픽업 위치가 다름(휘닉스·알펜시아·용평·횡계…).
//   - 약 70% 지구가 버스 운영(여유 좌석 공개), 나머지·부족 지구는 타지구 버스에 신청.
//   - 결제 깔때기: 신청 → 일부 매칭 → 일부 입금알림 → 일부 완료(예약번호). (즉시 paid 아님)
//   - 승인 대기 0(CCC 자동입장 모델). 거절·알림 일부 동반.
// 마커: operators.ccc_id LIKE 'load-%', trips.note LIKE '[LOAD]%', region_locations.label LIKE '[LOAD]%'

assertLocal();
const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const STUDENTS = Number(arg("students", 1000));
const REGIONS = arg("regions", "all");
const WIPE = !!arg("wipe", false);

const rand = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rand(a.length)];
const chance = (p) => Math.random() < p;
const code = () =>
  "BUS-" + Array.from({ length: 4 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[rand(30)]).join("");

// 수련회 일정 — 상행(입소)·하행(퇴소)
const UP_DAY = "2026-06-23"; // 입소: 지구 → 평창
const DOWN_DAY = "2026-06-27"; // 퇴소: 평창 → 지구
const at = (day, h, m = 0) =>
  new Date(
    `${day}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+09:00`,
  ).toISOString();

// 평창 내 지구별 픽업 위치(사람이 많아 지구마다 다름)
const PYEONGCHANG = [
  ["평창 휘닉스파크 정문", 37.575, 128.323],
  ["평창 알펜시아 리조트 입구", 37.658, 128.681],
  ["평창 용평리조트 발왕산케이블카", 37.643, 128.681],
  ["평창 횡계시외버스터미널", 37.667, 128.69],
  ["평창 대관령면 행정복지센터", 37.677, 128.717],
  ["평창 보광 휘닉스 주차장", 37.573, 128.32],
  ["평창 올림픽메달플라자", 37.659, 128.687],
];

const SURNAME = "김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하".split("");
const GIVEN = [
  "민준", "서준", "도윤", "예준", "시우", "하준", "주원", "지호", "지후", "준우", "현우", "건우", "우진", "선우", "연우",
  "서연", "서윤", "지우", "서현", "하은", "하윤", "민서", "지유", "윤서", "채원", "수아", "지아", "다은", "은서", "예은",
  "수빈", "지민", "예린", "소율", "유진", "수민", "현서", "나윤", "주은", "가은", "동현", "태윤", "승현", "재윤", "민재",
];
const UNIV = [
  "서울대", "연세대", "고려대", "성균관대", "한양대", "중앙대", "경희대", "서강대", "이화여대", "숙명여대",
  "부산대", "경북대", "전남대", "전북대", "충남대", "충북대", "강원대", "제주대", "인하대", "아주대",
  "동국대", "건국대", "홍익대", "국민대", "숭실대", "단국대", "영남대", "계명대", "조선대", "원광대", "순천향대", "한림대",
];
const name = () => pick(SURNAME) + pick(GIVEN);
const phone = () => `010-${String(1000 + rand(9000))}-${String(1000 + rand(9000))}`;
// 한국 본토 대략 좌표(지도 표시용·정확 주소 아님)
const krLat = () => 35.1 + Math.random() * 2.4;
const krLng = () => 126.6 + Math.random() * 2.4;
// 송금 안내용 은행 정보(공급 지구) — regions.bank_*. 식별위험 없는 무작위 더미.
const BANKS = ["국민은행", "농협", "카카오뱅크", "신한은행", "우리은행", "토스뱅크"];
const digits = (n) => Array.from({ length: n }, () => rand(10)).join("");
const bankAccountNo = () => `${digits(3)}-${digits(2)}-${digits(6)}`;

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
async function delIn(table, col, values) {
  // UUID 100개 초과를 .in()에 넣으면 DELETE URL이 너무 길어짐(URI too long) → 작게 청크.
  for (let i = 0; i < values.length; i += 100) {
    const { error } = await db.from(table).delete().in(col, values.slice(i, i + 100));
    if (error) throw new Error(`${table} 삭제 실패: ${error.message}`);
  }
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
    await delIn("match_passengers", "match_id", mIds);
    const reqs = await idsIn("seat_requests", "trip_id", tripIds);
    const rIds = reqs.map((r) => r.id);
    await delIn("rejection_log", "seat_request_id", rIds);
    await delIn("matches", "trip_id", tripIds);
    await delIn("request_passengers", "request_id", rIds);
    await delIn("seat_requests", "trip_id", tripIds);
    await delIn("seat_offers", "trip_id", tripIds);
    await delIn("trips", "id", tripIds);
  }
  if (opIds.length) await delIn("notifications", "operator_id", opIds);
  const { error: locErr } = await db.from("region_locations").delete().like("label", "[LOAD]%");
  if (locErr) throw new Error(`region_locations 삭제 실패: ${locErr.message}`);
  if (opIds.length) await delIn("operators", "id", opIds);
  // regions는 [LOAD] 마커가 없는 공용 마스터데이터 → 더미가 채운 송금정보를 null로 되돌림(로컬 전용).
  await db.from("regions").update({ bank_name: null, bank_account: null, account_holder: null }).not("bank_name", "is", null);
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

  // 1) 간사: 지구당 1명(공급·수요 통합)
  const operators = [];
  const opOf = {};
  for (const r of regions) {
    const id = randomUUID();
    opOf[r.id] = id;
    operators.push({
      id,
      region_id: r.id,
      ccc_id: `load-op-${r.code}`,
      name: `[LOAD]${r.name} 간사`,
      phone: phone(),
      approval_status: "approved",
      approved_at: new Date().toISOString(),
      role: "operator",
    });
  }
  await insertChunked("operators", operators);

  // 2) 약 70% 지구가 버스 운영(공급). 나머지는 수요 전용.
  const supplyRegions = regions.filter(() => chance(0.7));
  if (supplyRegions.length === 0) supplyRegions.push(regions[0]);

  // 공급 지구 송금 정보(regions.bank_*) — 수요 간사가 송금할 계좌. 화면 송금 안내에 노출.
  for (const r of supplyRegions) {
    await db
      .from("regions")
      .update({
        bank_name: pick(BANKS),
        bank_account: bankAccountNo(),
        account_holder: `${r.name} 총무`,
      })
      .eq("id", r.id);
  }

  // 3) 공급 지구별 상행+하행 trip + 평창/지구 위치 + 공개 좌석(offer)
  const locs = [];
  const trips = [];
  const offers = [];
  const tripMeta = []; // {id, regionId, direction, remaining}
  let pcIdx = 0;
  for (const r of supplyRegions) {
    const pc = PYEONGCHANG[pcIdx++ % PYEONGCHANG.length];
    const rLat = krLat();
    const rLng = krLng();
    const capacity = pick([28, 44, 45]);
    const price = 20000 + rand(13) * 2500; // 20,000 ~ 50,000

    // 위치 4종(상행/하행 × origin/destination)
    const upOrigin = randomUUID();
    const upDest = randomUUID();
    const downOrigin = randomUUID();
    const downDest = randomUUID();
    locs.push(
      { id: upOrigin, region_id: r.id, direction: "up", location_type: "origin", address: `${r.name} 집결지`, label: `[LOAD]${r.name} 출발`, lat: rLat, lng: rLng, is_default: true, created_by: opOf[r.id] },
      { id: upDest, region_id: r.id, direction: "up", location_type: "destination", address: pc[0], label: `[LOAD]${pc[0]}`, lat: pc[1], lng: pc[2], is_default: true, created_by: opOf[r.id] },
      { id: downOrigin, region_id: r.id, direction: "down", location_type: "origin", address: pc[0], label: `[LOAD]${pc[0]}`, lat: pc[1], lng: pc[2], is_default: true, created_by: opOf[r.id] },
      { id: downDest, region_id: r.id, direction: "down", location_type: "destination", address: `${r.name} 집결지`, label: `[LOAD]${r.name} 도착`, lat: rLat, lng: rLng, is_default: true, created_by: opOf[r.id] },
    );

    // 상행(지구→평창)
    const upId = randomUUID();
    trips.push({ id: upId, operator_region_id: r.id, direction: "up", origin_location_id: upOrigin, destination_location_id: upDest, departure_at: at(UP_DAY, 6 + rand(4), pick([0, 30])), capacity, price_per_seat: price, note: `[LOAD] ${r.name}→평창 입소차량`, status: "published", created_by: opOf[r.id] });
    // 하행(평창→지구)
    const downId = randomUUID();
    trips.push({ id: downId, operator_region_id: r.id, direction: "down", origin_location_id: downOrigin, destination_location_id: downDest, departure_at: at(DOWN_DAY, 10 + rand(4), pick([0, 30])), capacity, price_per_seat: price, note: `[LOAD] 평창→${r.name} 퇴소차량`, status: "published", created_by: opOf[r.id] });

    // 공개 좌석(여유분) — 정원의 일부만 타지구에 오픈
    const upSpare = 8 + rand(Math.max(1, capacity - 12));
    const downSpare = 8 + rand(Math.max(1, capacity - 12));
    offers.push({ id: randomUUID(), trip_id: upId, seat_count: upSpare, status: "open" });
    offers.push({ id: randomUUID(), trip_id: downId, seat_count: downSpare, status: "open" });
    tripMeta.push({ id: upId, regionId: r.id, direction: "up", remaining: upSpare });
    tripMeta.push({ id: downId, regionId: r.id, direction: "down", remaining: downSpare });
  }
  await insertChunked("region_locations", locs);
  await insertChunked("trips", trips);
  await insertChunked("seat_offers", offers);

  // 4) 신청: 타지구 간사가 자기 학생들을 공급 trip에 신청(목표 인원까지)
  const requests = [];
  const passengers = [];
  const matches = [];
  const mpax = [];
  const matchedReqIds = [];
  const rejections = [];
  const usedCodes = new Set();
  let made = 0;
  let guard = 0;

  while (made < STUDENTS && guard < STUDENTS * 3) {
    guard++;
    const trip = pick(tripMeta);
    // 신청 지구 = 공급 지구가 아닌 다른 지구(자기 버스 신청 방지)
    const reqRegion = pick(regions);
    if (reqRegion.id === trip.regionId) continue;

    const n = Math.min(1 + rand(6), STUDENTS - made);
    const reqId = randomUUID();
    const requestedAt = new Date(Date.now() - rand(96) * 36e5).toISOString();
    requests.push({ id: reqId, trip_id: trip.id, region_id: reqRegion.id, operator_id: opOf[reqRegion.id], seat_count: n, status: "queued", consent_confirmed_at: requestedAt, consent_confirmed_by: opOf[reqRegion.id], requested_at: requestedAt });

    const pax = [];
    for (let i = 0; i < n; i++) {
      const p = { id: randomUUID(), request_id: reqId, name: name(), phone: phone(), school_or_role: pick(UNIV), priority: i + 1 };
      pax.push(p);
      passengers.push(p);
    }
    made += n;
    const reqRow = requests[requests.length - 1];

    // 신청 결과 분기: 거절(8%) / 매칭(좌석 있으면 55%) / 대기(나머지)
    if (chance(0.08)) {
      const reason = pick([
        "정원 초과로 이번 차량 매칭이 어렵습니다.",
        "출발 시간이 맞지 않아 매칭 보류합니다.",
        "해당 노선 좌석이 모두 마감되었습니다.",
      ]);
      rejections.push({ id: randomUUID(), seat_request_id: reqId, reason, rejected_by: opOf[trip.regionId], created_at: new Date(Date.now() - rand(48) * 36e5).toISOString() });
      reqRow.status = "rejected";
      reqRow.reject_reason = reason;
      continue;
    }
    if (trip.remaining >= n && chance(0.55)) {
      trip.remaining -= n;
      reqRow.status = "matched";
      matchedReqIds.push(reqId);
      // 결제 깔때기: awaiting_payment 40% / payment_reported 25% / paid 35%
      const roll = Math.random();
      const matchedAt = new Date(Date.now() - rand(72) * 36e5).toISOString();
      for (const p of pax) {
        const mId = randomUUID();
        let status = "awaiting_payment";
        let payment_reported_at = null;
        let paid_at = null;
        let reservation_code = null;
        if (roll > 0.65) {
          status = "paid";
          payment_reported_at = new Date(Date.now() - rand(36) * 36e5).toISOString();
          paid_at = new Date(Date.now() - rand(18) * 36e5).toISOString();
          let c = code();
          while (usedCodes.has(c)) c = code();
          usedCodes.add(c);
          reservation_code = c;
        } else if (roll > 0.4) {
          status = "payment_reported";
          payment_reported_at = new Date(Date.now() - rand(24) * 36e5).toISOString();
        }
        matches.push({ id: mId, trip_id: trip.id, request_id: reqId, passenger_id: p.id, status, matched_at: matchedAt, payment_reported_at, paid_at, payment_due_at: new Date(Date.now() + 48 * 36e5).toISOString(), reservation_code });
        mpax.push({ match_id: mId, name: p.name, phone: p.phone, school_or_role: p.school_or_role });
      }
    }
    // 나머지는 queued(대기) 유지
  }

  await insertChunked("seat_requests", requests);
  await insertChunked("request_passengers", passengers);
  await insertChunked("matches", matches);
  await insertChunked("match_passengers", mpax);
  await insertChunked("rejection_log", rejections);

  // 5) 흐름에 맞는 최근 알림 일부(공급 간사에게 request_new)
  const notifs = [];
  for (const t of tripMeta.slice(0, 20)) {
    notifs.push({ id: randomUUID(), channel: "in_app", type: "request_new", operator_id: opOf[t.regionId], delivery_status: "sent", sent_at: new Date().toISOString(), created_at: new Date().toISOString() });
  }
  await insertChunked("notifications", notifs);

  const paidCount = matches.filter((m) => m.status === "paid").length;
  const queuedCount = requests.filter((r) => r.status === "queued").length;
  console.log("✅ 완료(현실 모델):");
  console.log(`   간사 ${operators.length} · 공급지구 ${supplyRegions.length} · trip ${trips.length}(상행+하행)`);
  console.log(`   신청 ${requests.length}(대기 ${queuedCount}) · 학생 ${passengers.length} · 매칭 ${matches.length}(paid ${paidCount}) · 거절 ${rejections.length}`);
  console.log("   QA 샘플 예약번호(학생 /r):");
  matches
    .filter((m) => m.reservation_code)
    .slice(0, 5)
    .forEach((m) => {
      const p = mpax.find((x) => x.match_id === m.id);
      console.log(`     ${m.reservation_code}  (이름=${p.name}, 끝4=${p.phone.slice(-4)})`);
    });
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});

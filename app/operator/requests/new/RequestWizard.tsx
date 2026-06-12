"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KakaoMultiMap, type MapPin } from "@/components/kakao/KakaoMultiMap";
import { DIRECTION_SHORT } from "@/lib/labels";
import { formatKstDateTime, formatWon } from "@/lib/datetime";
import { createRequest, createWaitRequest, type PassengerInput } from "../actions";

// page.tsx 에서 내려주는 차량 1건.
// 지도 핀 좌표(map*)는 '지역(우리 동네)' 지점 — 가는편=출발지, 오는편=도착지.
export type WizardTrip = {
  id: string;
  direction: "up" | "down";
  departureAt: string; // ISO (UTC)
  pricePerSeat: number;
  regionName: string;
  regionArea: string | null;
  originLabel: string;
  destinationLabel: string;
  mapLabel: string;
  mapLat: number | null;
  mapLng: number | null;
  availableSeats: number;
};

// 지구 선택지 — 전체 지구(본인 제외). 차량 없는 지구도 포함(대기큐 신청 대상).
// id는 대기 신청(createWaitRequest)의 waitRegionId 해석용.
export type RegionOption = { id: string; name: string; area: string | null };

type Step = 1 | 2 | 3;

type PassengerRow = PassengerInput & { key: number };

function emptyRow(key: number): PassengerRow {
  return { key, name: "", phone: "", schoolOrRole: "", note: "" };
}

// ISO(UTC) → KST 기준 "YYYY-MM-DD" (조회 날짜 일치 비교용)
function toKstDateKey(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return k.slice(0, 10);
}

// 시도(area) → 권역. 근처 권역 추천에 사용. 미매핑(특수·해외 등)은 권역 없음(추천 X).
const AREA_TO_KWONYEOK: Record<string, string> = {
  서울: "수도권",
  경기: "수도권",
  인천: "수도권",
  강원: "강원",
  충남: "충청",
  충북: "충청",
  대전: "충청",
  세종: "충청",
  전북: "호남",
  전남: "호남",
  광주: "호남",
  경북: "영남",
  경남: "영남",
  부산: "영남",
  대구: "영남",
  울산: "영남",
  제주: "제주",
};
function kwonyeokOf(area: string | null): string | null {
  return area ? (AREA_TO_KWONYEOK[area] ?? null) : null;
}

export function RequestWizard({
  trips,
  regionOptions,
}: {
  trips: WizardTrip[];
  regionOptions: RegionOption[];
}) {
  const [step, setStep] = useState<Step>(1);

  // Step1: 조회 조건.
  //  - regionName = 어느 지구의 차량을 탈지(공급 지구). 예) 부산.
  //  - direction = 상행(선택지구→평창) / 하행(평창→선택지구). 스왑으로 전환.
  //  - 기본 선택 = 공급 차량이 있는 첫 지구(가나다순). 없으면 첫 지구.
  const [regionName, setRegionName] = useState<string>(
    () =>
      regionOptions.find((o) => trips.some((t) => t.regionName === o.name))?.name ??
      regionOptions[0]?.name ??
      "",
  );
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [date, setDate] = useState<string>(""); // "YYYY-MM-DD" (KST), 비우면 전체
  const [headcount, setHeadcount] = useState<number>(1);
  const [consent, setConsent] = useState(false);

  // Step2: 조회 결과·선택
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Step3: 명단
  const [rows, setRows] = useState<PassengerRow[]>([emptyRow(0)]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 대기큐 모드 — 선택 지구 차량이 0대일 때 trip 없이 그 지구 대기큐에 신청 (#대기큐).
  const [waitMode, setWaitMode] = useState(false);
  const [desiredDate, setDesiredDate] = useState<string>(""); // 희망 출발일 (선택)

  const selectedArea = regionOptions.find((o) => o.name === regionName)?.area ?? null;
  const selectedKwon = kwonyeokOf(selectedArea);

  // 출발/도착 라벨 (방향 토글에 따라 선택지구 ⇄ 평창)
  const fromLabel = direction === "up" ? regionName : "평창";
  const toLabel = direction === "up" ? "평창" : regionName;

  // 방향·날짜로 1차 필터 → 정확 일치(선택지구)와 권역 추천으로 분리.
  const { exact, recommended } = useMemo(() => {
    const byDir = trips.filter((t) => {
      if (t.direction !== direction) return false;
      if (date && toKstDateKey(t.departureAt) !== date) return false;
      return true;
    });
    return {
      exact: byDir.filter((t) => t.regionName === regionName),
      recommended: byDir.filter(
        (t) => t.regionName !== regionName && selectedKwon && kwonyeokOf(t.regionArea) === selectedKwon,
      ),
    };
  }, [trips, direction, date, regionName, selectedKwon]);

  const allResults = useMemo(() => [...exact, ...recommended], [exact, recommended]);
  const selectedTrip = allResults.find((t) => t.id === selectedId) ?? null;

  // 선택 지구에 (날짜 무관) 이 방향 차량이 하나라도 있는지 — 대기큐 안내 문구 분기용
  // (있으면 "그 날짜엔 없음", 없으면 "아직 안 올림" — 학생 위저드와 동일 기준).
  const exactAnyDate = useMemo(
    () => trips.some((t) => t.direction === direction && t.regionName === regionName),
    [trips, direction, regionName],
  );

  // 지도 핀 — '지역' 지점 좌표가 있는 차량만. title=공급지구명, subtitle=노선/시각.
  const pins: MapPin[] = useMemo(() => {
    return allResults
      .filter((t) => t.mapLat !== null && t.mapLng !== null)
      .map((t) => ({
        id: t.id,
        lat: t.mapLat as number,
        lng: t.mapLng as number,
        title: `${t.regionName} (${t.mapLabel})`,
        subtitle: `[${DIRECTION_SHORT[t.direction]}] ${t.originLabel} → ${t.destinationLabel} · ${formatKstDateTime(t.departureAt)}`,
      }));
  }, [allResults]);

  function runSearch() {
    setError(null);
    setSelectedId(null);
    setWaitMode(false);
    setSearched(true);
    setStep(2);
  }

  // 인원 > 잔여석 이면 대기 신청.
  function isWaitlist(t: WizardTrip): boolean {
    return headcount > t.availableSeats;
  }

  // 인원 수만큼 명단 행 미리 준비 (이미 입력값 있으면 보존) — trip 선택·대기큐 공용.
  function prepareRows() {
    setRows((prev) => {
      if (prev.length >= headcount) return prev;
      const next = [...prev];
      let key = next.reduce((max, r) => Math.max(max, r.key), 0) + 1;
      while (next.length < headcount) next.push(emptyRow(key++));
      return next;
    });
  }

  function selectAndContinue(t: WizardTrip) {
    setSelectedId(t.id);
    setWaitMode(false);
    setError(null);
    prepareRows();
    setStep(3);
  }

  // 대기큐 모드로 Step3 진행 — 선택 지구가 버스를 안 올렸을 때(차량 선택 없이 명단 입력).
  function startWaitQueue() {
    setSelectedId(null);
    setWaitMode(true);
    setError(null);
    setDesiredDate(date); // Step1 날짜 필터를 희망일 초기값으로 (비워뒀으면 공란)
    prepareRows();
    setStep(3);
  }

  // ── Step3 명단 편집 ──
  const nextKey = () => rows.reduce((max, r) => Math.max(max, r.key), 0) + 1;
  function updateRow(key: number, field: keyof PassengerInput, value: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }
  function addRow() {
    setRows((prev) => [...prev, emptyRow(nextKey())]);
  }
  function removeRow(key: number) {
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.key !== key)));
  }
  function move(index: number, dir: -1 | 1) {
    setRows((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function handleSubmit() {
    setError(null);
    const payload: PassengerInput[] = rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      schoolOrRole: r.schoolOrRole,
      note: r.note,
    }));

    // 대기큐 모드 — trip 없이 대상 지구 대기큐로 신청 (waitRegionId는 선택지에서 해석).
    if (waitMode) {
      const waitRegionId = regionOptions.find((o) => o.name === regionName)?.id;
      if (!waitRegionId) {
        setError("지구 정보를 찾을 수 없습니다. 조회 조건을 다시 확인해주세요.");
        setStep(1);
        return;
      }
      startTransition(async () => {
        const result = await createWaitRequest({
          waitRegionId,
          direction,
          desiredDate: desiredDate || null,
          passengers: payload,
          consent,
        });
        if (result?.error) setError(result.error);
        // 성공 시 서버 액션이 /operator/requests 로 redirect
      });
      return;
    }

    if (!selectedTrip) {
      setError("신청할 차량을 다시 선택해주세요.");
      setStep(2);
      return;
    }
    startTransition(async () => {
      const result = await createRequest(selectedTrip.id, payload, consent);
      if (result?.error) setError(result.error);
      // 성공 시 서버 액션이 /operator/requests 로 redirect
    });
  }

  // 결과 카드 1장 (정확/추천 공용)
  function tripCard(t: WizardTrip) {
    const waitlist = isWaitlist(t);
    const active = selectedId === t.id;
    return (
      <li key={t.id}>
        <div
          className={`rounded-lg border transition-colors ${
            active ? "border-blue-400 bg-blue-50" : "border-gray-200"
          }`}
        >
          <button
            type="button"
            onClick={() => setSelectedId(t.id)}
            aria-pressed={active}
            className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left"
          >
            <span className="min-w-0">
              <span className="block font-medium text-gray-900">
                [{DIRECTION_SHORT[t.direction]}] {t.originLabel} → {t.destinationLabel}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500">
                {t.regionName} · {formatKstDateTime(t.departureAt)} 출발 · {formatWon(t.pricePerSeat)}/인
              </span>
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs whitespace-nowrap ${
                t.availableSeats > 0 ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
              }`}
            >
              잔여 {t.availableSeats}석
            </span>
          </button>

          {active && (
            <div className="border-t px-3 pt-3 pb-3">
              {waitlist && (
                <p className="mb-2 text-xs text-amber-600">
                  자리가 없어 대기열에 들어갑니다. (요청 {headcount}명 / 잔여 {t.availableSeats}석)
                </p>
              )}
              <button
                type="button"
                onClick={() => selectAndContinue(t)}
                className={`inline-flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium text-white ${
                  waitlist ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {waitlist ? "대기 신청" : "신청"}
              </button>
            </div>
          )}
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-6">
      <StepHeader step={step} />

      {/* ───────── Step 1: 조회 ───────── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* 출발 ⇄ 도착 — 한 쪽은 선택 지구, 한 쪽은 평창 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">어디 차량을 탈까요?</label>
            <div className="flex items-stretch gap-2">
              <RegionOrPyeongchang
                role="출발"
                isRegion={direction === "up"}
                regionName={regionName}
                options={regionOptions}
                onChange={(v) => {
                  setRegionName(v);
                  setSelectedId(null);
                }}
              />
              <button
                type="button"
                onClick={() => {
                  setDirection((d) => (d === "up" ? "down" : "up"));
                  setSelectedId(null);
                }}
                aria-label="출발·도착 바꾸기"
                className="shrink-0 rounded-lg border border-gray-200 px-3 text-lg text-gray-500 hover:bg-gray-50"
              >
                ⇄
              </button>
              <RegionOrPyeongchang
                role="도착"
                isRegion={direction === "down"}
                regionName={regionName}
                options={regionOptions}
                onChange={(v) => {
                  setRegionName(v);
                  setSelectedId(null);
                }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {DIRECTION_SHORT[direction]} — {fromLabel} → {toLabel}. 선택한 지구의 공급 차량을
              먼저 보여주고, 근처 권역 차량도 추천합니다.
            </p>
          </div>

          {/* 날짜 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              날짜 <span className="font-normal text-gray-400">(선택 — 비우면 전체)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {date && (
                <button
                  type="button"
                  onClick={() => setDate("")}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  지우기
                </button>
              )}
            </div>
          </div>

          {/* 인원 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">인원</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setHeadcount((n) => Math.max(1, n - 1))}
                className="h-9 w-9 rounded-lg border border-gray-300 text-lg text-gray-600 hover:bg-gray-50"
                aria-label="인원 줄이기"
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={45}
                value={headcount}
                onChange={(e) => setHeadcount(Math.min(45, Math.max(1, Number(e.target.value) || 1)))}
                className="w-16 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setHeadcount((n) => Math.min(45, n + 1))}
                className="h-9 w-9 rounded-lg border border-gray-300 text-lg text-gray-600 hover:bg-gray-50"
                aria-label="인원 늘리기"
              >
                +
              </button>
              <span className="text-sm text-gray-500">명</span>
            </div>
          </div>

          {/* 개인정보 동의 */}
          <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 accent-blue-600"
            />
            <span className="text-gray-600">
              학생 개인정보(이름·전화)를 차량 매칭·운행 안내 목적으로 수집·이용하는 데 동의합니다.
              (수련회 종료 후 90일 보관 뒤 익명화)
            </span>
          </label>

          <Button onClick={runSearch} disabled={!consent || !regionName} className="w-full">
            버스 조회
          </Button>
        </div>
      )}

      {/* ───────── Step 2: 결과 ───────── */}
      {step === 2 && searched && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {fromLabel} → {toLabel} · {DIRECTION_SHORT[direction]}
            {date ? ` · ${date}` : " · 전체 날짜"} · {headcount}명
          </div>

          {/* 지역(지구) 지점 지도 — 가는편 출발지 / 오는편 도착지 */}
          {allResults.length > 0 && (
            <KakaoMultiMap pins={pins} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} />
          )}

          {/* 정확 일치 — 선택한 지구 차량 */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-700">
              {regionName} 차량{" "}
              <span className="font-normal text-gray-400">({exact.length})</span>
            </h3>
            {exact.length === 0 ? (
              // 대기큐 안내 — 선택 지구 차량 0대면(권역 추천 유무와 무관) 미배정 대기 신청 제안.
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-sm font-medium text-amber-800">
                  {exactAnyDate
                    ? `「${regionName}」는 ${date}에 출발하는 ${DIRECTION_SHORT[direction]} 버스가 없어요.`
                    : `「${regionName}」는 아직 ${DIRECTION_SHORT[direction]} 버스를 올리지 않았어요.`}
                </p>
                <p className="mt-1 text-xs text-amber-700">
                  대기큐에 신청을 넣어두면 버스가 생길 때 {regionName} 간사가 배정해요.
                  {recommended.length > 0 && " 아래 권역 추천 차량을 먼저 확인해봐도 좋아요."}
                </p>
                <button
                  type="button"
                  onClick={startWaitQueue}
                  className="mt-2 inline-flex h-9 w-full items-center justify-center rounded-lg bg-amber-500 text-sm font-medium text-white hover:bg-amber-600"
                >
                  {regionName} 대기큐에 신청 넣기
                </button>
              </div>
            ) : (
              <ul className="space-y-2">{exact.map(tripCard)}</ul>
            )}
          </div>

          {/* 권역 추천 */}
          {recommended.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-700">
                🔁 근처 권역 추천{" "}
                <span className="font-normal text-gray-400">
                  ({selectedKwon ?? "권역"} · {recommended.length})
                </span>
              </h3>
              <ul className="space-y-2">{recommended.map(tripCard)}</ul>
            </div>
          )}

          <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full">
            ← 조회 조건 수정
          </Button>
        </div>
      )}

      {/* ───────── Step 3: 명단 ───────── */}
      {step === 3 && (waitMode || selectedTrip) && (
        <div className="space-y-5">
          {/* 요약 — 대기큐 모드는 차량 대신 대기 신청 안내, 아니면 선택한 차량 */}
          {waitMode ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
              <div className="text-sm font-medium text-gray-900">
                버스 미배정 대기 신청 — {regionName} 대기큐
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                [{DIRECTION_SHORT[direction]}] {fromLabel} → {toLabel}
              </div>
              <div className="mt-1 text-xs text-amber-700">
                버스가 생기면 {regionName} 간사가 배정해요. 배정되면 알림으로 알려드립니다.
              </div>
            </div>
          ) : (
            selectedTrip && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
                <div className="text-sm font-medium text-gray-900">
                  [{DIRECTION_SHORT[selectedTrip.direction]}] {selectedTrip.originLabel} →{" "}
                  {selectedTrip.destinationLabel}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  {selectedTrip.regionName} · {formatKstDateTime(selectedTrip.departureAt)} 출발 ·{" "}
                  {formatWon(selectedTrip.pricePerSeat)}/인 · 잔여 {selectedTrip.availableSeats}석
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  탑승 위치: {selectedTrip.originLabel} (공급 지구 지정)
                </div>
              </div>
            )
          )}

          {!waitMode && selectedTrip && isWaitlist(selectedTrip) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              ⚠ 잔여 {selectedTrip.availableSeats}석보다 많은 {headcount}명을 신청합니다. 자리가 없어
              일부 인원은 이용이 어려울 수 있습니다. (대기열 등록)
            </p>
          )}

          {/* 희망 출발일 — 대기큐 모드 전용 (선택, 배정 시 공급 간사 참고용) */}
          {waitMode && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                희망 출발일{" "}
                <span className="font-normal text-gray-400">(선택 — 배정 시 참고용)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={desiredDate}
                  onChange={(e) => setDesiredDate(e.target.value)}
                  disabled={isPending}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {desiredDate && (
                  <button
                    type="button"
                    onClick={() => setDesiredDate("")}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    지우기
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 학생 명단 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">
                학생 명단{" "}
                <span className="font-normal text-gray-400">
                  (위에서부터 우선순위 — 공급 간사 참고용 힌트)
                </span>
              </label>
              <span className="text-xs text-gray-400">{rows.length}명</span>
            </div>

            <ul className="space-y-2">
              {rows.map((r, i) => (
                <li key={r.key} className="rounded-lg border border-gray-200 p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700">
                      {i + 1}
                    </span>
                    <span className="text-xs text-gray-400">우선순위 {i + 1}</span>
                    <div className="ml-auto flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(i, -1)}
                        disabled={isPending || i === 0}
                        className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                        aria-label="위로"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => move(i, 1)}
                        disabled={isPending || i === rows.length - 1}
                        className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                        aria-label="아래로"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeRow(r.key)}
                        disabled={isPending || rows.length === 1}
                        className="rounded px-1.5 py-0.5 text-xs text-red-400 hover:bg-red-50 disabled:opacity-30"
                        aria-label="삭제"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(r.key, "name", e.target.value)}
                      placeholder="이름 *"
                      maxLength={50}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={r.phone}
                      onChange={(e) => updateRow(r.key, "phone", e.target.value)}
                      placeholder="전화번호 *"
                      inputMode="tel"
                      maxLength={13}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={r.schoolOrRole}
                      onChange={(e) => updateRow(r.key, "schoolOrRole", e.target.value)}
                      placeholder="학교/역할 (선택)"
                      maxLength={100}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <input
                      value={r.note}
                      onChange={(e) => updateRow(r.key, "note", e.target.value)}
                      placeholder="메모 (선택)"
                      maxLength={200}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </li>
              ))}
            </ul>

            <Button type="button" variant="outline" size="sm" onClick={addRow} disabled={isPending}>
              + 학생 추가
            </Button>
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isPending}>
              {waitMode ? "← 결과로 돌아가기" : "← 차량 다시 선택"}
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
              {isPending
                ? "신청중..."
                : waitMode
                  ? "대기큐 신청하기"
                  : selectedTrip && isWaitlist(selectedTrip)
                    ? "대기 신청하기"
                    : "신청하기"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// 출발/도착 박스 — isRegion이면 지구 선택 <select>, 아니면 평창 고정.
function RegionOrPyeongchang({
  role,
  isRegion,
  regionName,
  options,
  onChange,
}: {
  role: "출발" | "도착";
  isRegion: boolean;
  regionName: string;
  options: RegionOption[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-center">
      <div className="text-xs text-gray-400">{role}</div>
      {isRegion ? (
        <select
          value={regionName}
          onChange={(e) => onChange(e.target.value)}
          className="mt-0.5 w-full bg-transparent text-center font-medium text-gray-900 focus:outline-none"
          aria-label="지구 선택"
        >
          {options.map((o) => (
            <option key={o.name} value={o.name}>
              {o.name}
            </option>
          ))}
        </select>
      ) : (
        <div className="mt-0.5 py-1 font-medium text-gray-900">평창</div>
      )}
    </div>
  );
}

function StepHeader({ step }: { step: Step }) {
  const labels: Record<Step, string> = { 1: "조회", 2: "차량 선택", 3: "명단 입력" };
  return (
    <ol className="flex items-center gap-2 text-xs">
      {([1, 2, 3] as const).map((n, i) => (
        <li key={n} className="flex items-center gap-2">
          <span
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-medium ${
              step === n
                ? "bg-blue-600 text-white"
                : step > n
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-400"
            }`}
          >
            {n}
          </span>
          <span className={step >= n ? "text-gray-700" : "text-gray-400"}>{labels[n]}</span>
          {i < 2 && <span className="text-gray-300">→</span>}
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KakaoMultiMap, type MapPin } from "@/components/kakao/KakaoMultiMap";
import { DIRECTION_SHORT } from "@/lib/labels";
import { formatKstDateTime, formatWon } from "@/lib/datetime";
import { createRequest, type PassengerInput } from "../actions";

// page.tsx 에서 내려주는 차량 1건. 평창 픽업 좌표는 상행=도착지/하행=출발지 위치(평창 쪽).
export type WizardTrip = {
  id: string;
  direction: "up" | "down";
  departureAt: string; // ISO (UTC)
  pricePerSeat: number;
  regionName: string;
  originLabel: string;
  destinationLabel: string;
  pyeongchangLabel: string;
  pyeongchangLat: number | null;
  pyeongchangLng: number | null;
  availableSeats: number;
};

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

export function RequestWizard({
  trips,
  myRegionName,
}: {
  trips: WizardTrip[];
  myRegionName: string;
}) {
  const [step, setStep] = useState<Step>(1);

  // Step1: 조회 조건. direction = 본인지구 → 평창(상행) 이 기본. 스왑하면 하행.
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

  // 출발/도착 라벨 (방향 토글에 따라 본인지구 ⇄ 평창)
  const fromLabel = direction === "up" ? myRegionName : "평창";
  const toLabel = direction === "up" ? "평창" : myRegionName;

  // 조회 조건에 맞는 차량만. (방향 일치 + 날짜 지정 시 같은 KST일 일치)
  const results = useMemo(() => {
    return trips.filter((t) => {
      if (t.direction !== direction) return false;
      if (date && toKstDateKey(t.departureAt) !== date) return false;
      return true;
    });
  }, [trips, direction, date]);

  const selectedTrip = results.find((t) => t.id === selectedId) ?? null;

  // 지도 핀 — 평창 픽업 좌표가 있는 차량만. title=공급지구명, subtitle=노선/시각.
  const pins: MapPin[] = useMemo(() => {
    return results
      .filter((t) => t.pyeongchangLat !== null && t.pyeongchangLng !== null)
      .map((t) => ({
        id: t.id,
        lat: t.pyeongchangLat as number,
        lng: t.pyeongchangLng as number,
        title: `${t.regionName} (${t.pyeongchangLabel})`,
        subtitle: `[${DIRECTION_SHORT[t.direction]}] ${t.originLabel} → ${t.destinationLabel} · ${formatKstDateTime(t.departureAt)}`,
      }));
  }, [results]);

  function swapDirection() {
    setDirection((d) => (d === "up" ? "down" : "up"));
    // 방향이 바뀌면 이전 선택은 무효 (결과 목록이 바뀜)
    setSelectedId(null);
  }

  function runSearch() {
    setError(null);
    setSelectedId(null);
    setSearched(true);
    setStep(2);
  }

  // 인원 > 잔여석 이면 대기 신청.
  function isWaitlist(t: WizardTrip): boolean {
    return headcount > t.availableSeats;
  }

  function selectAndContinue(t: WizardTrip) {
    setSelectedId(t.id);
    setError(null);
    // 인원 수만큼 명단 행 미리 준비 (이미 입력값 있으면 보존)
    setRows((prev) => {
      if (prev.length >= headcount) return prev;
      const next = [...prev];
      let key = next.reduce((max, r) => Math.max(max, r.key), 0) + 1;
      while (next.length < headcount) next.push(emptyRow(key++));
      return next;
    });
    setStep(3);
  }

  // ── Step3 명단 편집 (기존 NewRequestForm UI 재사용) ──
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
    if (!selectedTrip) {
      setError("신청할 차량을 다시 선택해주세요.");
      setStep(2);
      return;
    }
    const payload: PassengerInput[] = rows.map((r) => ({
      name: r.name,
      phone: r.phone,
      schoolOrRole: r.schoolOrRole,
      note: r.note,
    }));
    startTransition(async () => {
      const result = await createRequest(selectedTrip.id, payload, consent);
      if (result?.error) setError(result.error);
      // 성공 시 서버 액션이 /operator/requests 로 redirect
    });
  }

  return (
    <div className="space-y-6">
      <StepHeader step={step} />

      {/* ───────── Step 1: 조회 ───────── */}
      {step === 1 && (
        <div className="space-y-5">
          {/* 출발 ⇄ 도착 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">가는 방향</label>
            <div className="flex items-stretch gap-2">
              <div className="flex-1 rounded-lg border border-gray-200 px-3 py-3 text-center">
                <div className="text-xs text-gray-400">출발</div>
                <div className="font-medium text-gray-900">{fromLabel}</div>
              </div>
              <button
                type="button"
                onClick={swapDirection}
                aria-label="출발·도착 바꾸기"
                className="shrink-0 rounded-lg border border-gray-200 px-3 text-lg text-gray-500 hover:bg-gray-50"
              >
                ⇄
              </button>
              <div className="flex-1 rounded-lg border border-gray-200 px-3 py-3 text-center">
                <div className="text-xs text-gray-400">도착</div>
                <div className="font-medium text-gray-900">{toLabel}</div>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {DIRECTION_SHORT[direction]} — {fromLabel}에서 {toLabel}로 이동하는 타지구 차량을
              조회합니다.
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
                onChange={(e) =>
                  setHeadcount(Math.min(45, Math.max(1, Number(e.target.value) || 1)))
                }
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

          <Button onClick={runSearch} disabled={!consent} className="w-full">
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

          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed py-16 text-center text-sm text-gray-400">
              조건에 맞는 타지구 공급 차량이 없습니다.
              <br />
              방향·날짜를 바꿔 다시 조회해보세요.
            </div>
          ) : (
            <>
              {/* 평창 픽업 위치 지도 */}
              <KakaoMultiMap
                pins={pins}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId(id)}
              />

              {/* 차량 카드 목록 */}
              <ul className="space-y-2">
                {results.map((t) => {
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
                              {t.regionName} · {formatKstDateTime(t.departureAt)} 출발 ·{" "}
                              {formatWon(t.pricePerSeat)}/인
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                              t.availableSeats > 0
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            잔여 {t.availableSeats}석
                          </span>
                        </button>

                        {active && (
                          <div className="border-t px-3 pt-3 pb-3">
                            {waitlist && (
                              <p className="mb-2 text-xs text-amber-600">
                                자리가 없어 대기열에 들어갑니다. (요청 {headcount}명 / 잔여{" "}
                                {t.availableSeats}석)
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={() => selectAndContinue(t)}
                              className={`inline-flex h-9 w-full items-center justify-center rounded-lg text-sm font-medium text-white ${
                                waitlist
                                  ? "bg-amber-500 hover:bg-amber-600"
                                  : "bg-blue-600 hover:bg-blue-700"
                              }`}
                            >
                              {waitlist ? "대기 신청" : "신청"}
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full">
            ← 조회 조건 수정
          </Button>
        </div>
      )}

      {/* ───────── Step 3: 명단 ───────── */}
      {step === 3 && selectedTrip && (
        <div className="space-y-5">
          {/* 선택한 차량 요약 */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
            <div className="text-sm font-medium text-gray-900">
              [{DIRECTION_SHORT[selectedTrip.direction]}] {selectedTrip.originLabel} →{" "}
              {selectedTrip.destinationLabel}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {selectedTrip.regionName} · {formatKstDateTime(selectedTrip.departureAt)} 출발 ·{" "}
              {formatWon(selectedTrip.pricePerSeat)}/인 · 잔여 {selectedTrip.availableSeats}석
            </div>
          </div>

          {isWaitlist(selectedTrip) && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              ⚠ 잔여 {selectedTrip.availableSeats}석보다 많은 {headcount}명을 신청합니다. 자리가
              없어 일부 인원은 이용이 어려울 수 있습니다. (대기열 등록)
            </p>
          )}

          {/* 학생 명단 (기존 NewRequestForm UI) */}
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

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(2)}
              disabled={isPending}
            >
              ← 차량 다시 선택
            </Button>
            <Button onClick={handleSubmit} disabled={isPending} className="flex-1">
              {isPending
                ? "신청중..."
                : isWaitlist(selectedTrip)
                  ? "대기 신청하기"
                  : "신청하기"}
            </Button>
          </div>
        </div>
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

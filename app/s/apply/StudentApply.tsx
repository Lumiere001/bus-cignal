"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { KakaoMultiMap, type MapPin } from "@/components/kakao/KakaoMultiMap";
import { DIRECTION_SHORT } from "@/lib/labels";
import { formatKstDateTime, formatWon } from "@/lib/datetime";
import { createStudentRequest, createStudentWaitRequest } from "../actions";

// page.tsx 에서 내려주는 신청 가능 차량 1건 (published + 잔여>0).
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

// 지구 선택지 — 전체 지구(버스 없는 지구 포함). id는 대기큐 신청(createStudentWaitRequest) 대상 해석용.
export type RegionOption = { id: string; name: string; area: string | null };

// 만석 포함 published 차량이 존재하는 지구·방향 — trips(잔여>0만)와 별도로 내려받아
// "만석"과 "버스 안 올림"을 구분해 안내한다.
export type PublishedRegionDirection = { regionName: string; direction: "up" | "down" };
type Step = 1 | 2 | 3;

// ISO(UTC) → KST 기준 "YYYY-MM-DD" (조회 날짜 일치 비교용)
function toKstDateKey(iso: string): string {
  const k = new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString();
  return k.slice(0, 10);
}

// 시도(area) → 권역. 근처 권역 추천에 사용 (간사 마법사와 동일 표).
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

export function StudentApply({
  trips,
  publishedRegionDirections,
  regionOptions,
  studentRegionName,
  studentName,
  studentPhone,
}: {
  trips: WizardTrip[];
  publishedRegionDirections: PublishedRegionDirection[];
  regionOptions: RegionOption[];
  studentRegionName: string | null;
  studentName: string;
  studentPhone: string;
}) {
  const [step, setStep] = useState<Step>(1);

  // Step1: 조회 조건 — 어느 지구 차량을(공급 지구) + 방향(상/하행) + 날짜(선택).
  // 기본 지구 = 본인 출신 지구(가는편은 보통 우리 지구 차량부터 찾으므로), 없으면 첫 옵션.
  const [regionName, setRegionName] = useState<string>(() =>
    studentRegionName && regionOptions.some((o) => o.name === studentRegionName)
      ? studentRegionName
      : (regionOptions[0]?.name ?? ""),
  );
  const [direction, setDirection] = useState<"up" | "down">("up");
  const [date, setDate] = useState<string>("");
  const [searched, setSearched] = useState(false);

  // Step2~3: 선택·동의
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // 대기큐 모드 — 선택 지구에 버스가 없을 때 Step3를 "대기 신청 확인"으로 전환.
  const [waitMode, setWaitMode] = useState(false);
  const [waitDate, setWaitDate] = useState<string>(""); // 희망 출발일(선택)

  const selectedArea = regionOptions.find((o) => o.name === regionName)?.area ?? null;
  const selectedKwon = kwonyeokOf(selectedArea);

  const fromLabel = direction === "up" ? regionName : "평창";
  const toLabel = direction === "up" ? "평창" : regionName;

  // 방향·날짜로 1차 필터 → 정확 일치(선택지구) + 권역 추천 분리.
  const { exact, recommended } = useMemo(() => {
    const byDir = trips.filter((t) => {
      if (t.direction !== direction) return false;
      if (date && toKstDateKey(t.departureAt) !== date) return false;
      return true;
    });
    return {
      exact: byDir.filter((t) => t.regionName === regionName),
      recommended: byDir.filter(
        (t) =>
          t.regionName !== regionName &&
          selectedKwon &&
          kwonyeokOf(t.regionArea) === selectedKwon,
      ),
    };
  }, [trips, direction, date, regionName, selectedKwon]);

  const allResults = useMemo(() => [...exact, ...recommended], [exact, recommended]);
  const selectedTrip = allResults.find((t) => t.id === selectedId) ?? null;

  // 선택 지구에 (날짜 무관) 이 방향 차량이 하나라도 있는지 — 대기큐 안내 문구 분기용.
  // trips는 잔여>0만 내려오므로 exactAnyDate=false여도 "버스 안 올림"이 아니라 만석일 수 있다.
  const exactAnyDate = useMemo(
    () => trips.some((t) => t.direction === direction && t.regionName === regionName),
    [trips, direction, regionName],
  );

  // 선택 지구가 (만석 포함) 이 방향 published 차량을 올렸는지 — 만석 vs 미공개 구분용.
  const publishedAnyDate = useMemo(
    () =>
      publishedRegionDirections.some(
        (p) => p.direction === direction && p.regionName === regionName,
      ),
    [publishedRegionDirections, direction, regionName],
  );

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

  function selectAndContinue(t: WizardTrip) {
    setSelectedId(t.id);
    setWaitMode(false);
    setConsent(false);
    setError(null);
    setStep(3);
  }

  // 대기큐 신청 진입 — 차량 선택 없이 Step3(대기 신청 확인)로. 희망일은 조회 날짜로 프리필.
  function startWaitApply() {
    setSelectedId(null);
    setWaitMode(true);
    setConsent(false);
    setError(null);
    setWaitDate(date);
    setStep(3);
  }

  function handleSubmit() {
    if (!selectedTrip) {
      setError("신청할 차량을 다시 선택해주세요.");
      setStep(2);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createStudentRequest(selectedTrip.id, consent);
      // 성공 시 서버 액션이 /s 로 redirect → 아래는 실패(에러)만 도달.
      if (result?.error) setError(result.error);
    });
  }

  function handleWaitSubmit() {
    const region = regionOptions.find((o) => o.name === regionName);
    if (!region) {
      setError("지구 정보를 찾을 수 없어요. 조회 조건을 다시 확인해주세요.");
      setStep(1);
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createStudentWaitRequest({
        waitRegionId: region.id,
        direction,
        desiredDate: waitDate || null,
        consent,
      });
      // 성공 시 서버 액션이 /s 로 redirect → 실패(중복 신청 등)만 아래 도달해 표면화.
      if (result?.error) setError(result.error);
    });
  }

  // 선택 지구 결과 0대일 때 안내 + 대기큐 신청 진입. (권역 추천이 있어도 exact 0이면 노출)
  function waitNotice(hasRecommendations = false) {
    return (
      <div className="space-y-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
        <p className="text-sm font-medium text-amber-800">
          {/* 만석(published 있음 + 잔여 0)을 "안 올렸다"로 단정하지 않도록 3분기 */}
          {exactAnyDate
            ? `선택한 날짜에는 ${regionName}의 ${DIRECTION_SHORT[direction]} 차량이 없어요.`
            : publishedAnyDate
              ? `지금은 ${regionName}의 ${DIRECTION_SHORT[direction]} 차량 자리가 다 찼어요.`
              : `「${regionName}」는 아직 ${DIRECTION_SHORT[direction]} 버스를 올리지 않았어요.`}
        </p>
        <p className="text-xs text-amber-700">
          {!exactAnyDate && publishedAnyDate
            ? `자리가 나거나 버스가 더 생기면 ${regionName} 간사가 배정할 수 있도록 대기큐에 신청해둘 수 있어요.`
            : `대기큐에 신청해두면 버스가 생길 때 ${regionName} 간사가 배정해요.`}
          {hasRecommendations && " 아래 근처 권역 차량을 바로 신청할 수도 있어요."}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={startWaitApply}
          className="w-full border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
        >
          {regionName} 대기큐에 신청 넣기
        </Button>
      </div>
    );
  }

  // Step3 공용 블록 — 차량 신청·대기 신청 양쪽에서 동일하게 사용(문구 단일화).
  const applicantBox = (
    <div className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
      <p className="text-xs text-gray-400">신청자 (CCC 계정 정보)</p>
      <p className="mt-0.5 font-medium text-gray-900">
        {studentName} <span className="font-normal text-gray-500">· {studentPhone}</span>
      </p>
    </div>
  );

  const consentBox = (
    <label className="flex cursor-pointer items-start gap-2 rounded-lg bg-gray-50 px-3 py-3 text-sm">
      <input
        type="checkbox"
        checked={consent}
        onChange={(e) => setConsent(e.target.checked)}
        disabled={isPending}
        className="mt-0.5 accent-blue-600"
      />
      <span className="text-gray-600">
        내 개인정보(이름·전화)를 차량 매칭·운행 안내 목적으로 수집·이용하는 데 동의합니다.
        (수련회 종료 후 90일 보관 뒤 익명화)
      </span>
    </label>
  );

  function tripCard(t: WizardTrip) {
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
            <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-xs whitespace-nowrap text-green-700">
              잔여 {t.availableSeats}석
            </span>
          </button>

          {active && (
            <div className="border-t px-3 pt-3 pb-3">
              <button
                type="button"
                onClick={() => selectAndContinue(t)}
                className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
              >
                이 차량 신청
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
              {DIRECTION_SHORT[direction]} — {fromLabel} → {toLabel}. 선택한 지구 차량을 먼저
              보여주고, 근처 권역 차량도 추천해요.
            </p>
          </div>

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

          <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
            본인 1명으로 신청돼요 — 신청자: <b className="text-gray-700">{studentName}</b> ·{" "}
            {studentPhone}
          </p>

          <Button onClick={runSearch} disabled={!regionName} className="w-full">
            버스 조회
          </Button>
        </div>
      )}

      {/* ───────── Step 2: 결과 ───────── */}
      {step === 2 && searched && (
        <div className="space-y-4">
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
            {fromLabel} → {toLabel} · {DIRECTION_SHORT[direction]}
            {date ? ` · ${date}` : " · 전체 날짜"} · 본인 1명
          </div>

          {allResults.length === 0 ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-dashed py-10 text-center text-sm text-gray-400">
                {regionName}의 {DIRECTION_SHORT[direction]} 공급 차량이 없고, 근처 권역 추천도
                없어요.
                <br />
                지구·방향·날짜를 바꿔 다시 조회해보세요.
              </div>
              {waitNotice()}
            </div>
          ) : (
            <>
              <KakaoMultiMap pins={pins} selectedId={selectedId} onSelect={(id) => setSelectedId(id)} />

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-700">
                  {regionName} 차량{" "}
                  <span className="font-normal text-gray-400">({exact.length})</span>
                </h3>
                {exact.length === 0 ? (
                  waitNotice(recommended.length > 0)
                ) : (
                  <ul className="space-y-2">{exact.map(tripCard)}</ul>
                )}
              </div>

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
            </>
          )}

          <Button type="button" variant="outline" onClick={() => setStep(1)} className="w-full">
            ← 조회 조건 수정
          </Button>
        </div>
      )}

      {/* ───────── Step 3: 신청 확인 (차량 신청) ───────── */}
      {step === 3 && !waitMode && selectedTrip && (
        <div className="space-y-5">
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

          {applicantBox}
          {consentBox}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isPending}>
              ← 차량 다시 선택
            </Button>
            <Button onClick={handleSubmit} disabled={isPending || !consent} className="flex-1">
              {isPending ? "신청중..." : "신청하기"}
            </Button>
          </div>
        </div>
      )}

      {/* ───────── Step 3: 신청 확인 (버스 미배정 대기) ───────── */}
      {step === 3 && waitMode && (
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
            <div className="text-sm font-medium text-gray-900">
              버스 미배정 대기 신청 — {regionName} 대기큐
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              [{DIRECTION_SHORT[direction]}] {fromLabel} → {toLabel} · 본인 1명
            </div>
            <div className="mt-1 text-xs text-amber-700">
              아직 버스가 없어 대기큐에 등록돼요. 버스가 생기면 {regionName} 간사가 배정하고,
              이후 승인·입금 절차는 일반 신청과 동일해요.
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              희망 출발일 <span className="font-normal text-gray-400">(선택 — 비우면 무관)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={waitDate}
                onChange={(e) => setWaitDate(e.target.value)}
                disabled={isPending}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {waitDate && (
                <button
                  type="button"
                  onClick={() => setWaitDate("")}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  지우기
                </button>
              )}
            </div>
          </div>

          {applicantBox}
          {consentBox}

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)} disabled={isPending}>
              ← 결과로
            </Button>
            <Button onClick={handleWaitSubmit} disabled={isPending || !consent} className="flex-1">
              {isPending ? "신청중..." : "대기큐 신청하기"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// 출발/도착 박스 — isRegion이면 지구 선택, 아니면 평창 고정.
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
  const labels: Record<Step, string> = { 1: "조회", 2: "차량 선택", 3: "신청" };
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

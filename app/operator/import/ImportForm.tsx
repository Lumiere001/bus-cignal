"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  parseImportCsv,
  normalizeRegionName,
  parseUsage,
  USAGE_LABEL,
  TEMPLATE_CSV,
  MAX_IMPORT_ROWS,
  type RowError,
} from "@/lib/import/parse";
import {
  importPreCollected,
  getTripRoster,
  type ImportResult,
  type RosterEntry,
} from "./actions";

export type TripOption = { id: string; label: string };
export type RegionOption = { id: string; name: string };

// 화면에서 편집 중인 1행 — 지구는 드롭다운 선택(regionId). CSV 자동 매칭 실패 시
// regionId=""(미선택)로 두고 원문(regionRaw)을 보여줘서 간사가 직접 고르게 한다.
type EditableRow = {
  regionId: string;
  regionRaw: string | null; // CSV 원문 (매칭 실패 안내용)
  name: string;
  phone: string;
  usage: string;
  appliedAt: string | null; // KST ISO — 대기 순서 반영
};

const EMPTY_ROW: EditableRow = { regionId: "", regionRaw: null, name: "", phone: "", usage: "왕복", appliedAt: null };
const USAGE_OPTIONS = Object.values(USAGE_LABEL); // 왕복 / 편도(갈 때) / 편도(올 때)

function formatAppliedAt(iso: string): string {
  // "2026-06-01T10:00:00+09:00" → "6/1 10:00"
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return iso;
  return `${Number(m[1])}/${Number(m[2])} ${m[3]}:${m[4]}`;
}

const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none";

/** 중복 판정 키 — 서버(personKey)와 같은 기준: 차량 × 이름 × 연락처. */
function dupKey(tripId: string, name: string, phone: string): string {
  return `${tripId}:${name.trim()}:${phone.replace(/[^0-9]/g, "")}`;
}

export function ImportForm({
  goTrips,
  returnTrips,
  regions,
}: {
  goTrips: TripOption[];
  returnTrips: TripOption[];
  regions: RegionOption[];
}) {
  const [goTripId, setGoTripId] = useState<string>(goTrips[0]?.id ?? "");
  const [returnTripId, setReturnTripId] = useState<string>(returnTrips[0]?.id ?? "");
  const [rows, setRows] = useState<EditableRow[]>([]);
  const [fileErrors, setFileErrors] = useState<RowError[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // CSV 지구명 → region id 자동 매칭 ("인천"·"인천지구" 동일 취급)
  const regionIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of regions) map.set(normalizeRegionName(r.name), r.id);
    return map;
  }, [regions]);

  // 선택한 차량의 기존 명단 — 중복 표시용 (차량 바꿀 때마다 새로 조회)
  useEffect(() => {
    const ids = [goTripId, returnTripId].filter(Boolean);
    if (ids.length === 0) return;
    let cancelled = false;
    getTripRoster(ids).then((r) => {
      if (!cancelled) setRoster(r);
    });
    return () => {
      cancelled = true;
    };
  }, [goTripId, returnTripId]);

  const existingKeys = useMemo(
    () => new Set(roster.map((e) => dupKey(e.tripId, e.name, e.phone))),
    [roster],
  );

  // ── 1단계: 형식 검증 (지구 선택·이름·전화·버스 이용) ──────────────────────────
  const formatStates = useMemo(
    () =>
      rows.map((row) => {
        const name = row.name.trim();
        const phone = row.phone.replace(/[^0-9]/g, "");
        const usage = parseUsage(row.usage);
        if (!row.regionId)
          return {
            ok: false,
            message: row.regionRaw
              ? `지구 '${row.regionRaw}'를 찾을 수 없어요 — 목록에서 직접 선택해주세요.`
              : "지구를 선택해주세요.",
          };
        if (name.length < 1 || name.length > 50) return { ok: false, message: "이름을 1~50자로 입력해주세요." };
        if (phone.length < 10 || phone.length > 11)
          return { ok: false, message: "연락처를 올바르게 입력해주세요. (010-1234-5678)" };
        if (!usage) return { ok: false, message: "버스 이용 형태를 선택해주세요." };
        return { ok: true as const, message: null };
      }),
    [rows],
  );

  const inlineFormatErrors = formatStates.filter((s) => !s.ok).length;
  // 형식 단계: 표 안 오류 + 업로드 시 건너뛴 행이 하나라도 있으면 '형식 먼저' 단계.
  const formatBlocked = inlineFormatErrors > 0 || fileErrors.length > 0;

  // ── 2단계: 중복 검증 — 형식이 모두 맞은 뒤에만 판정 ──────────────────────────
  const dupFlags = useMemo(() => {
    if (formatBlocked) return rows.map(() => false); // 형식 먼저 — 중복 판정 보류
    const seen = new Set<string>();
    return rows.map((row, i) => {
      if (!formatStates[i]?.ok) return false;
      const name = row.name.trim();
      const phone = row.phone.replace(/[^0-9]/g, "");
      const usage = parseUsage(row.usage);
      const targets: string[] = [];
      if ((usage === "round" || usage === "go") && goTripId) targets.push(dupKey(goTripId, name, phone));
      if ((usage === "round" || usage === "return") && returnTripId) targets.push(dupKey(returnTripId, name, phone));
      const isDup = targets.some((k) => existingKeys.has(k) || seen.has(k));
      targets.forEach((k) => seen.add(k));
      return isDup;
    });
  }, [rows, formatStates, formatBlocked, existingKeys, goTripId, returnTripId]);

  const dupCount = dupFlags.filter(Boolean).length;
  // 실제 등록될 행 = 형식 OK + 중복 아님
  const registerable = rows
    .map((row, i) => ({ row, i }))
    .filter(({ i }) => formatStates[i]?.ok && !dupFlags[i]);
  const validCount = registerable.length;

  const needsGo = registerable.some(({ row }) => /왕복|갈/.test(row.usage));
  const needsReturn = registerable.some(({ row }) => /왕복|올/.test(row.usage));

  const canSubmit =
    !submitting &&
    !formatBlocked &&
    validCount > 0 &&
    consent &&
    (!needsGo || goTripId !== "") &&
    (!needsReturn || returnTripId !== "");

  function downloadTemplate() {
    const blob = new Blob(["\uFEFF" + TEMPLATE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "사전신청-템플릿.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const { rows: parsed, errors } = parseImportCsv(text);
    setFileName(file.name);
    setFileErrors(errors);
    setResult(null);
    setRows(
      parsed.map((r) => ({
        regionId: regionIdByName.get(normalizeRegionName(r.region)) ?? "",
        regionRaw: r.region,
        name: r.name,
        phone: r.phone,
        usage: USAGE_LABEL[r.usage],
        appliedAt: r.appliedAt,
      })),
    );
    if (fileRef.current) fileRef.current.value = ""; // 같은 파일 재선택 허용
  }

  function updateRow(i: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit() {
    setSubmitting(true);
    setResult(null);
    try {
      const payload = registerable.map(({ row }) => ({
        regionId: row.regionId,
        name: row.name,
        phone: row.phone,
        usage: row.usage,
        appliedAt: row.appliedAt,
      }));
      const res = await importPreCollected({
        goTripId: needsGo ? goTripId : null,
        returnTripId: needsReturn ? returnTripId : null,
        rows: payload,
        consent,
      });
      setResult(res);
      if (res.ok) {
        setRows([]);
        setFileErrors([]);
        setFileName(null);
        setConsent(false);
        const ids = [goTripId, returnTripId].filter(Boolean);
        if (ids.length > 0) setRoster(await getTripRoster(ids));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // 등록 완료 화면
  if (result?.ok) {
    return (
      <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
        <p className="font-semibold text-green-800">
          ✅ 등록 완료 — 신청 {result.requestCount}건 · 학생 {result.passengerCount}명이 대기 큐에
          들어갔어요.
          {result.duplicateCount > 0 && ` (중복 ${result.duplicateCount}건은 제외)`}
        </p>
        <p className="text-sm text-green-700">
          대기 순서는 신청 시각(타임스탬프) 기준으로 반영됐어요. 예약번호는 발급되지 않았습니다 —
          일반 신청과 똑같이 승인·매칭을 진행하고, 입금 확인 시점에 발급됩니다.
        </p>
        <div className="flex gap-3 text-sm">
          <Link href="/operator/trips" className="font-medium text-green-800 underline underline-offset-4">
            차량 신청 현황 보기 →
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-green-700 underline underline-offset-4"
          >
            추가로 등록하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1) CSV 업로드 / 템플릿 — 템플릿 강제 안내를 눈에 띄게 */}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">1. 명단 불러오기</h2>

        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
          <p className="font-bold">⚠️ 반드시 ‘템플릿 CSV’ 형식에 맞춰 올려주세요.</p>
          <p className="mt-1">
            구글 스프레드시트를 그대로 내려받아 올리면 컬럼이 맞지 않아 등록되지 않을 수 있어요.
            아래 <b>템플릿 CSV 받기</b>로 양식을 받아 <b>지구·이름·연락처·버스 이용</b> 컬럼을 맞춘 뒤
            올려주세요. (구글폼 응답 시트의 <b>타임스탬프</b> 컬럼이 있으면 신청 순서로 자동 반영돼요.)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cursor-pointer rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
            📂 CSV 파일 선택
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
          </label>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ⬇️ 템플릿 CSV 받기
          </button>
          {fileName && <span className="text-muted-foreground text-xs">불러온 파일: {fileName}</span>}
        </div>
        {fileErrors.length > 0 && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            <p className="font-semibold">
              ⛔ 형식이 맞지 않는 행 {fileErrors.length}개 — 먼저 형식을 맞춰 다시 올려주세요.
            </p>
            <ul className="mt-1 list-inside list-disc">
              {fileErrors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  {e.line > 0 ? `${e.line}행: ` : ""}
                  {e.message}
                </li>
              ))}
              {fileErrors.length > 10 && <li>… 외 {fileErrors.length - 10}개</li>}
            </ul>
          </div>
        )}
      </section>

      {/* 2) 명단 표 — 형식 먼저, 그 다음 중복 */}
      <section className="space-y-3 rounded-xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            2. 명단 확인{" "}
            <span className="text-muted-foreground font-normal">
              (등록 {validCount}명
              {!formatBlocked && dupCount > 0 ? ` · 중복 제외 ${dupCount}` : ""}
              {inlineFormatErrors > 0 ? ` · 형식 오류 ${inlineFormatErrors}` : ""})
            </span>
          </h2>
          <button
            type="button"
            onClick={() => setRows((prev) => [...prev, { ...EMPTY_ROW }])}
            disabled={rows.length >= MAX_IMPORT_ROWS}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            ＋ 행 추가
          </button>
        </div>

        {/* 단계 안내 — 형식 먼저, 통과하면 중복 안내로 전환 */}
        {rows.length > 0 && formatBlocked && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            ① 먼저 형식 오류({inlineFormatErrors + fileErrors.length}건)를 해결해주세요. 형식이 모두
            맞으면 그 다음에 중복 여부를 확인해 드려요.
          </p>
        )}
        {rows.length > 0 && !formatBlocked && dupCount > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            ② 형식은 모두 맞았어요. 중복 {dupCount}건(이미 대기 큐에 있거나 목록 내 겹침)은 자동
            제외되며, 그대로 등록하면 안전합니다.
          </p>
        )}

        {rows.length === 0 ? (
          <p className="text-muted-foreground rounded-lg bg-gray-50 px-3 py-6 text-center text-sm">
            CSV를 올리거나 ‘행 추가’로 직접 입력해주세요.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-1 py-2 font-medium">지구</th>
                  <th className="px-1 py-2 font-medium">이름</th>
                  <th className="px-1 py-2 font-medium">연락처</th>
                  <th className="px-1 py-2 font-medium">버스 이용</th>
                  <th className="px-1 py-2 font-medium">신청 시각</th>
                  <th className="px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const fmt = formatStates[i];
                  const isDup = dupFlags[i];
                  const tone = !fmt?.ok ? "bg-red-50/50" : isDup ? "bg-amber-50" : "";
                  return (
                    <tr key={i} className={`border-b last:border-b-0 ${tone}`}>
                      <td className="px-1 py-1.5">
                        <select
                          value={row.regionId}
                          onChange={(e) => updateRow(i, { regionId: e.target.value })}
                          className={inputCls}
                        >
                          <option value="">{row.regionRaw ? `? ${row.regionRaw}` : "지구 선택"}</option>
                          {regions.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          value={row.name}
                          onChange={(e) => updateRow(i, { name: e.target.value })}
                          placeholder="홍길동"
                          className={inputCls}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <input
                          value={row.phone}
                          onChange={(e) => updateRow(i, { phone: e.target.value })}
                          placeholder="010-1234-5678"
                          inputMode="numeric"
                          className={inputCls}
                        />
                      </td>
                      <td className="px-1 py-1.5">
                        <select
                          value={row.usage}
                          onChange={(e) => updateRow(i, { usage: e.target.value })}
                          className={inputCls}
                        >
                          {USAGE_OPTIONS.map((o) => (
                            <option key={o} value={o}>
                              {o}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="text-muted-foreground px-1 py-1.5 text-xs whitespace-nowrap tabular-nums">
                        {row.appliedAt ? formatAppliedAt(row.appliedAt) : "—"}
                      </td>
                      <td className="px-1 py-1.5 text-right align-top">
                        <button
                          type="button"
                          onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label={`${i + 1}행 삭제`}
                          className="text-xs text-gray-400 hover:text-red-500"
                        >
                          ✕
                        </button>
                        {!fmt?.ok ? (
                          <p className="mt-0.5 w-44 text-right text-[11px] leading-tight text-red-500">
                            {fmt?.message}
                          </p>
                        ) : isDup ? (
                          <p className="mt-0.5 w-44 text-right text-[11px] leading-tight text-amber-600">
                            이미 대기 큐에 있어요 — 제외됩니다.
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 3) 차량 선택 — 왕복=양쪽, 편도=해당 방향 */}
      <section className="space-y-3 rounded-xl border p-4">
        <h2 className="text-sm font-semibold">3. 등록할 차량</h2>
        <p className="text-muted-foreground text-xs">
          왕복 행은 가는편·오는편 양쪽에, 편도 행은 해당 방향 차량에만 신청이 만들어집니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700" htmlFor="go-trip">
              가는편 차량 {needsGo && <span className="text-red-500">*</span>}
            </label>
            <select
              id="go-trip"
              value={goTripId}
              onChange={(e) => setGoTripId(e.target.value)}
              className={inputCls}
            >
              <option value="">선택 안 함</option>
              {goTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {needsGo && goTrips.length === 0 && (
              <p className="text-[11px] text-red-500">공개 중인 가는편 차량이 없습니다. 차량을 먼저 공개해주세요.</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700" htmlFor="return-trip">
              오는편 차량 {needsReturn && <span className="text-red-500">*</span>}
            </label>
            <select
              id="return-trip"
              value={returnTripId}
              onChange={(e) => setReturnTripId(e.target.value)}
              className={inputCls}
            >
              <option value="">선택 안 함</option>
              {returnTrips.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            {needsReturn && returnTrips.length === 0 && (
              <p className="text-[11px] text-red-500">공개 중인 오는편 차량이 없습니다. 차량을 먼저 공개해주세요.</p>
            )}
          </div>
        </div>
      </section>

      {/* 4) 동의 + 제출 */}
      <section className="space-y-3 rounded-xl border p-4">
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5"
          />
          <span>원 수합(구글폼 등) 시 학생들에게 개인정보 수집·이용 동의를 받았음을 확인합니다.</span>
        </label>
        {result && !result.ok && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            <p>{result.error}</p>
            {result.rowErrors && result.rowErrors.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs">
                {result.rowErrors.slice(0, 10).map((e, i) => (
                  <li key={i}>
                    {e.index + 1}번째 행: {e.message}
                  </li>
                ))}
                {result.rowErrors.length > 10 && <li>… 외 {result.rowErrors.length - 10}개</li>}
              </ul>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting
            ? "등록 중…"
            : formatBlocked
              ? "형식 오류를 먼저 해결해주세요"
              : `대기 큐에 등록 (${validCount}명)`}
        </button>
        <p className="text-muted-foreground text-center text-xs">
          예약번호는 발급되지 않습니다 — 입금 확인 후 발급됩니다.
        </p>
      </section>
    </div>
  );
}

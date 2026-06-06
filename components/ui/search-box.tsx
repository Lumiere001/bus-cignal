"use client";

// 재사용 검색 입력 — 간사 신청·매칭·정산 목록의 클라이언트 필터용(제어 컴포넌트).
// 부모(클라이언트 목록 컴포넌트)가 value/onChange를 들고 행을 필터링한다.

export function SearchBox({
  value,
  onChange,
  placeholder = "검색",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="border-input bg-background focus-visible:ring-ring w-full rounded-lg border py-2 pr-3 pl-9 text-sm focus-visible:ring-2 focus-visible:outline-none"
      />
    </div>
  );
}

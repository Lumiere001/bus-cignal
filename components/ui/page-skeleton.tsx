/**
 * 페이지 로딩 스켈레톤 — route segment의 loading.tsx에서 사용.
 * 네비게이션 클릭 즉시 표시되어(서버 컴포넌트 스트리밍 동안) "눌렀는데 반응 없음"을 방지.
 */
export function PageSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl animate-pulse space-y-4 px-4 py-8"
      role="status"
      aria-busy="true"
      aria-label="불러오는 중"
    >
      <div className="h-7 w-40 rounded bg-gray-200" />
      <div className="h-20 rounded-xl bg-gray-100" />
      <div className="h-20 rounded-xl bg-gray-100" />
      <div className="h-20 rounded-xl bg-gray-100" />
      <span className="sr-only">불러오는 중…</span>
    </div>
  );
}

import { PageSkeleton } from "@/components/ui/page-skeleton";

// 간사 콘솔 네비게이션 로딩 UI — 하위 라우트(차량·신청·매칭·정산 등) 이동 시 즉시 표시.
export default function Loading() {
  return <PageSkeleton />;
}

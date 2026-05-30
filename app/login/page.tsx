import { Placeholder } from "@/components/placeholder";

export default function Page() {
  // v1.1: 간사 인증 = CCC 로그인. ccc-summer 진입점에서 CCC 신원 전달 →
  // verifyCccToken(lib/auth/ccc) 검증 → signOperatorToken(lib/auth/operator-session)
  // 으로 자체 세션 발급. 신원 전달 방식 확정(CCC IT) 후 구현.
  return <Placeholder title="간사 로그인 (CCC 로그인 — 연동 대기)" />;
}

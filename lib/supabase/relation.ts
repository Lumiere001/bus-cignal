/**
 * Supabase 임베드 관계 정규화.
 *
 * `select("...trip(...)")` 같은 임베드는 관계가 1:1이라도 PostgREST 응답에서
 * 배열로 올 때가 있다(조인 카디널리티 추론에 따라). 호출부에서 매번 배열 분기를
 * 하지 않도록 첫 요소만 꺼내 단일 객체(또는 null)로 좁힌다.
 */
export function one<T>(rel: T | T[] | null): T | null {
  return Array.isArray(rel) ? (rel[0] ?? null) : rel;
}

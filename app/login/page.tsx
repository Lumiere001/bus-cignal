// 간사 로그인 안내 — CCC 본구현 전 임시로 "마스터가 보낸 입장 링크"로 들어온다.
// 공개 로그인 폼 없음(간사 명단·지구는 PII). 입장은 /login/o/<token> 라우트가 처리.
// CCC 신원전달 방식 확정 시 이 페이지를 CCC 로그인으로 교체.

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-5 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">간사 로그인</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          간사님은 <b>마스터가 보내드린 입장 링크</b>로 접속하시면 바로 로그인됩니다.
          링크는 카카오톡으로 전달받으셨을 거예요.
        </p>
      </div>

      {error === "invalid" && (
        <p
          role="alert"
          className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          입장 링크가 유효하지 않거나 만료되었습니다. 담당 마스터에게 링크 재발급을
          요청해 주세요.
        </p>
      )}

      <div className="rounded-xl border bg-muted/40 p-4 text-sm leading-relaxed">
        <p className="mb-1 font-medium">링크가 없으신가요?</p>
        <p className="text-muted-foreground">
          담당 마스터(운영자)에게 입장 링크를 요청해 주세요. 승인된 간사에게만 발급됩니다.
        </p>
      </div>
    </main>
  );
}

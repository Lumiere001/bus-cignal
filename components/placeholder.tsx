export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">
        {note ?? "준비 중 — Foundation Phase 1 placeholder"}
      </p>
    </main>
  );
}

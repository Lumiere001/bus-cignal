"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { publishTrip } from "./actions";

export function PublishTripButton({ tripId }: { tripId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await publishTrip(tripId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? "공개중..." : "타지구 공개"}
      </Button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

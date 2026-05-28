import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (lib/utils)", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toContain("px-2");
  });

  it("dedupes conflicting tailwind classes (tailwind-merge)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
});

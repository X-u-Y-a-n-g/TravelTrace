import { describe, expect, it } from "vitest";

import { cn, initials, qs, truncate } from "./utils";

describe("cn", () => {
  it("merges conflicting Tailwind classes", () => {
    expect(cn("px-2 text-sm", "px-4")).toBe("text-sm px-4");
  });

  it("keeps conditional classes", () => {
    const hidden = false;
    expect(cn("base", hidden && "hidden", "extra")).toBe("base extra");
  });
});

describe("initials", () => {
  it("uses the first two words", () => {
    expect(initials("Demo Traveller")).toBe("DT");
    expect(initials("Explorer")).toBe("E");
  });

  it("falls back for empty names", () => {
    expect(initials(null)).toBe("TT");
    expect(initials("  ")).toBe("TT");
  });
});

describe("qs", () => {
  it("skips empty values and serialises arrays and booleans", () => {
    const query = qs({
      page: 2,
      empty: "",
      missing: undefined,
      nothing: null,
      tags: ["kyoto", "nara"],
      favorite: false,
      unsorted: true,
    });
    expect(query).toBe("?page=2&tags=kyoto%2Cnara&favorite=false&unsorted=true");
  });

  it("returns an empty string when nothing is set", () => {
    expect(qs({})).toBe("");
    expect(qs({ tags: [] })).toBe("");
  });
});

describe("truncate", () => {
  it("adds an ellipsis only when needed", () => {
    expect(truncate("TravelTrace", 20)).toBe("TravelTrace");
    expect(truncate("TravelTrace", 7)).toBe("Travel…");
  });
});

import { describe, expect, it } from "vitest";

import {
  dateInputValue,
  formatBytes,
  formatDate,
  formatDateRange,
  formatNumber,
  formatOrdinal,
  tripLengthDays,
} from "./format";

describe("formatDateRange", () => {
  it("collapses a range inside one month", () => {
    expect(formatDateRange("2026-10-01", "2026-10-08")).toBe("Oct 1–8, 2026");
  });

  it("shows both months inside one year", () => {
    expect(formatDateRange("2026-10-30", "2026-11-02")).toBe("Oct 30 – Nov 2, 2026");
  });

  it("shows both years when needed", () => {
    expect(formatDateRange("2025-12-30", "2026-01-02")).toBe("Dec 30, 2025 – Jan 2, 2026");
  });

  it("handles missing dates", () => {
    expect(formatDateRange(null, null)).toBe("Dates to be decided");
    expect(formatDateRange("2026-10-01", null)).toBe("Oct 1, 2026");
    expect(formatDateRange(null, "2026-10-01")).toBe("Until Oct 1, 2026");
  });
});

describe("format helpers", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 MB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("formats ordinals", () => {
    expect(formatOrdinal(1)).toBe("1st");
    expect(formatOrdinal(2)).toBe("2nd");
    expect(formatOrdinal(3)).toBe("3rd");
    expect(formatOrdinal(4)).toBe("4th");
    expect(formatOrdinal(11)).toBe("11th");
    expect(formatOrdinal(22)).toBe("22nd");
  });

  it("formats numbers", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats date inputs", () => {
    expect(formatDate("2026-10-01T10:30:00")).toBe("Oct 1, 2026");
    expect(dateInputValue("2026-10-01T10:30:00")).toBe("2026-10-01");
    expect(dateInputValue(null)).toBe("");
  });

  it("counts trip days inclusively", () => {
    expect(tripLengthDays("2026-10-01", "2026-10-08")).toBe(8);
    expect(tripLengthDays("2026-10-01", "2026-10-01")).toBe(1);
    expect(tripLengthDays(null, "2026-10-01")).toBe(0);
  });
});

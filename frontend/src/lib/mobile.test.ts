import { describe, expect, it } from "vitest";

import { normalizeApiBase, serverLabel } from "./mobile";

describe("normalizeApiBase", () => {
  it("adds https and the API prefix", () => {
    expect(normalizeApiBase("example.com")).toBe("https://example.com/api/v1");
    expect(normalizeApiBase("https://example.com/")).toBe("https://example.com/api/v1");
    expect(normalizeApiBase("http://192.168.1.20:8000")).toBe(
      "http://192.168.1.20:8000/api/v1",
    );
  });

  it("keeps a subpath and an existing API prefix", () => {
    expect(normalizeApiBase("https://example.com/traveltrace")).toBe(
      "https://example.com/traveltrace/api/v1",
    );
    expect(normalizeApiBase("https://example.com/api/v1/")).toBe(
      "https://example.com/api/v1",
    );
  });

  it("rejects empty, non-HTTP and credential URLs", () => {
    expect(normalizeApiBase("")).toBeNull();
    expect(normalizeApiBase("ftp://example.com")).toBeNull();
    expect(normalizeApiBase("https://user:pass@example.com")).toBeNull();
    expect(normalizeApiBase("not a url")).toBeNull();
  });
});

describe("serverLabel", () => {
  it("hides the API suffix for display", () => {
    expect(serverLabel("https://example.com/api/v1")).toBe("https://example.com");
    expect(serverLabel("https://example.com/traveltrace/api/v1")).toBe(
      "https://example.com/traveltrace",
    );
  });
});

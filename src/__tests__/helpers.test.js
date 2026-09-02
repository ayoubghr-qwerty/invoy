import { describe, it, expect, vi, beforeEach } from "vitest";
import { todayIso, saveClientIfNew, PAGE_SIZES } from "../utils/helpers";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("todayIso", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    const result = todayIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns today's date", () => {
    const result = todayIso();
    const today = new Date().toISOString().slice(0, 10);
    expect(result).toBe(today);
  });
});

describe("PAGE_SIZES", () => {
  it("contains A4 and A5", () => {
    expect(PAGE_SIZES).toContain("A4");
    expect(PAGE_SIZES).toContain("A5");
  });
});

describe("saveClientIfNew", () => {
  beforeEach(() => {
    globalThis.window = globalThis.window || {};
    globalThis.window.api = {
      storeGet: vi.fn().mockResolvedValue([]),
      storeSet: vi.fn().mockResolvedValue(undefined),
    };
  });

  it("does nothing if client name is empty", async () => {
    await saveClientIfNew({ nom: "" });
    expect(globalThis.window.api.storeGet).not.toHaveBeenCalled();
    expect(globalThis.window.api.storeSet).not.toHaveBeenCalled();
  });

  it("does nothing if client name is whitespace only", async () => {
    await saveClientIfNew({ nom: "   " });
    expect(globalThis.window.api.storeGet).not.toHaveBeenCalled();
    expect(globalThis.window.api.storeSet).not.toHaveBeenCalled();
  });

  it("does nothing if client object is null", async () => {
    await saveClientIfNew(null);
    expect(globalThis.window.api.storeGet).not.toHaveBeenCalled();
  });

  it("adds a new client if not already present", async () => {
    await saveClientIfNew({ nom: "Client A", adresse: "123 Rue" });
    expect(globalThis.window.api.storeGet).toHaveBeenCalledWith("clients", []);
    expect(globalThis.window.api.storeSet).toHaveBeenCalledTimes(1);
    const saved = globalThis.window.api.storeSet.mock.calls[0][1];
    expect(saved).toHaveLength(1);
    expect(saved[0].nom).toBe("Client A");
    expect(saved[0]).toHaveProperty("id");
  });

  it("does not duplicate an existing client", async () => {
    globalThis.window.api.storeGet.mockResolvedValue([
      { nom: "Client A", adresse: "123 Rue", id: 1 },
    ]);
    await saveClientIfNew({ nom: "Client A", adresse: "123 Rue" });
    expect(globalThis.window.api.storeSet).not.toHaveBeenCalled();
  });

  it("matches case-insensitively", async () => {
    globalThis.window.api.storeGet.mockResolvedValue([
      { nom: "Client A", id: 1 },
    ]);
    await saveClientIfNew({ nom: "client a" });
    expect(globalThis.window.api.storeSet).not.toHaveBeenCalled();
  });
});

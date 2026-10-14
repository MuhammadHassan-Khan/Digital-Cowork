import { describe, expect, it } from "vitest";
import {
  MAX_MULTI_SHARES,
  planSubscriptions,
  resolveShareMode,
  selectSharer,
  visibleShareIds,
} from "@/lib/livekit/screen-share";

const IDS = ["a", "b", "c", "d", "e", "f", "g"];

describe("resolveShareMode", () => {
  it("defaults to the reliable single-share baseline", () => {
    expect(resolveShareMode(undefined)).toBe("single");
    expect(resolveShareMode(null)).toBe("single");
    expect(resolveShareMode("")).toBe("single");
    expect(resolveShareMode("false")).toBe("single");
    expect(resolveShareMode("0")).toBe("single");
    expect(resolveShareMode("banana")).toBe("single");
  });

  it("enables experimental multi-share only for explicit truthy values", () => {
    expect(resolveShareMode("true")).toBe("multi");
    expect(resolveShareMode("TRUE")).toBe("multi");
    expect(resolveShareMode("1")).toBe("multi");
    expect(resolveShareMode(" yes ")).toBe("multi");
  });
});

describe("selectSharer", () => {
  it("returns null when nothing is shared", () => {
    expect(selectSharer([], null)).toBeNull();
    expect(selectSharer([], "a")).toBeNull();
  });

  it("defaults to the first active share", () => {
    expect(selectSharer(IDS, null)).toBe("a");
  });

  it("keeps an explicit choice while that share exists", () => {
    expect(selectSharer(IDS, "c")).toBe("c");
  });

  it("falls back when the chosen sharer stops sharing", () => {
    expect(selectSharer(["b", "c"], "a")).toBe("b");
  });
});

describe("planSubscriptions (single baseline)", () => {
  it("subscribes ONLY to the selected share (PRD §5 viewer choice)", () => {
    const plan = planSubscriptions({
      mode: "single",
      shareIds: IDS,
      selectedId: "c",
    });
    expect(plan.c).toBe(true);
    for (const id of IDS) {
      if (id !== "c") expect(plan[id]).toBe(false);
    }
    expect(visibleShareIds(IDS, plan)).toEqual(["c"]);
  });

  it("subscribes to nothing without a selection", () => {
    const plan = planSubscriptions({
      mode: "single",
      shareIds: IDS,
      selectedId: null,
    });
    expect(Object.values(plan).every((v) => v === false)).toBe(true);
  });
});

describe("planSubscriptions (experimental multi-share)", () => {
  it("subscribes to all shares up to the cap", () => {
    const three = ["a", "b", "c"];
    const plan = planSubscriptions({ mode: "multi", shareIds: three, selectedId: "a" });
    expect(plan).toEqual({ a: true, b: true, c: true });
  });

  it("never subscribes to more than MAX_MULTI_SHARES", () => {
    const plan = planSubscriptions({
      mode: "multi",
      shareIds: IDS,
      selectedId: "a",
    });
    expect(visibleShareIds(IDS, plan)).toHaveLength(MAX_MULTI_SHARES);
    expect(visibleShareIds(IDS, plan)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("keeps the viewer's selection inside the cap when it falls outside", () => {
    const plan = planSubscriptions({
      mode: "multi",
      shareIds: IDS,
      selectedId: "g", // 7th share — would naturally be over the cap
    });
    const visible = visibleShareIds(IDS, plan);
    expect(visible).toContain("g");
    expect(visible).toHaveLength(MAX_MULTI_SHARES);
    expect(visible).not.toContain("e"); // last natural entry dropped instead
    expect(visible).toEqual(["a", "b", "c", "d", "g"]);
  });

  it("covers every share id in the plan", () => {
    const plan = planSubscriptions({
      mode: "multi",
      shareIds: IDS,
      selectedId: null,
    });
    for (const id of IDS) expect(typeof plan[id]).toBe("boolean");
  });
});

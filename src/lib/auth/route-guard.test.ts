import { describe, expect, it } from "vitest";
import {
  classifyPath,
  resolveRouteGuard,
  safeNextPath,
} from "@/lib/auth/route-guard";

describe("classifyPath", () => {
  it("classifies auth pages", () => {
    expect(classifyPath("/login")).toBe("auth");
    expect(classifyPath("/signup")).toBe("auth");
    expect(classifyPath("/login/extra")).toBe("auth");
  });

  it("classifies protected prefixes", () => {
    expect(classifyPath("/discover")).toBe("protected");
    expect(classifyPath("/profile")).toBe("protected");
    expect(classifyPath("/profile/abc")).toBe("protected");
    expect(classifyPath("/onboarding")).toBe("protected");
    expect(classifyPath("/rooms")).toBe("protected");
    expect(classifyPath("/rooms/xyz")).toBe("protected");
    expect(classifyPath("/invite")).toBe("protected");
    expect(classifyPath("/invite/some-token")).toBe("protected");
  });

  it("does not match prefixes partially", () => {
    expect(classifyPath("/discovery-land")).toBe("public");
    expect(classifyPath("/profiling")).toBe("public");
    expect(classifyPath("/invited-friend")).toBe("public");
    expect(classifyPath("/")).toBe("public");
    expect(classifyPath("/auth/confirm")).toBe("public");
  });
});

describe("safeNextPath", () => {
  it("defaults to discovery for empty input", () => {
    expect(safeNextPath(null)).toBe("/discover");
    expect(safeNextPath(undefined)).toBe("/discover");
    expect(safeNextPath("")).toBe("/discover");
  });

  it("accepts sane same-site paths", () => {
    expect(safeNextPath("/discover")).toBe("/discover");
    expect(safeNextPath("/profile/abc")).toBe("/profile/abc");
    expect(safeNextPath("/discover?q=react")).toBe("/discover?q=react");
  });

  it("rejects open-redirect attempts", () => {
    expect(safeNextPath("//evil.example")).toBe("/discover");
    expect(safeNextPath("/\\evil.example")).toBe("/discover");
    expect(safeNextPath("https://evil.example")).toBe("/discover");
    expect(safeNextPath("/javascript:alert(1)")).toBe("/discover");
  });

  it("rejects oversized values", () => {
    expect(safeNextPath(`/${"a".repeat(513)}`)).toBe("/discover");
  });
});

describe("resolveRouteGuard", () => {
  it("lets signed-out users reach public routes", () => {
    expect(
      resolveRouteGuard({ pathname: "/", configured: true, isAuthed: false }),
    ).toEqual({ kind: "allow" });
  });

  it("redirects signed-out users away from protected routes with next", () => {
    expect(
      resolveRouteGuard({
        pathname: "/profile/abc",
        configured: true,
        isAuthed: false,
      }),
    ).toEqual({ kind: "redirect", location: "/login?next=%2Fprofile%2Fabc" });
  });

  it("keeps signed-in users on protected routes", () => {
    expect(
      resolveRouteGuard({
        pathname: "/discover",
        configured: true,
        isAuthed: true,
      }),
    ).toEqual({ kind: "allow" });
  });

  it("redirects signed-in users away from auth pages", () => {
    expect(
      resolveRouteGuard({ pathname: "/login", configured: true, isAuthed: true }),
    ).toEqual({ kind: "redirect", location: "/discover" });
    expect(
      resolveRouteGuard({ pathname: "/signup", configured: true, isAuthed: true }),
    ).toEqual({ kind: "redirect", location: "/discover" });
  });

  it("keeps signed-out users on auth pages", () => {
    expect(
      resolveRouteGuard({
        pathname: "/login",
        configured: true,
        isAuthed: false,
      }),
    ).toEqual({ kind: "allow" });
  });

  it("sends protected routes to /login when unconfigured (truthful state)", () => {
    expect(
      resolveRouteGuard({
        pathname: "/discover",
        configured: false,
        isAuthed: false,
      }),
    ).toEqual({ kind: "redirect", location: "/login" });
  });

  it("lets auth pages render their configuration notice when unconfigured", () => {
    expect(
      resolveRouteGuard({
        pathname: "/login",
        configured: false,
        isAuthed: false,
      }),
    ).toEqual({ kind: "allow" });
  });
});

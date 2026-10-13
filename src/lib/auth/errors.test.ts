import { describe, expect, it } from "vitest";
import { AUTH_ERROR_MESSAGES, friendlyAuthError } from "@/lib/auth/errors";

describe("friendlyAuthError", () => {
  it("maps machine codes to friendly copy", () => {
    expect(friendlyAuthError({ code: "invalid_credentials" })).toBe(
      AUTH_ERROR_MESSAGES.invalidCredentials,
    );
    expect(friendlyAuthError({ code: "email_not_confirmed" })).toBe(
      AUTH_ERROR_MESSAGES.emailNotConfirmed,
    );
    expect(friendlyAuthError({ code: "user_already_exists" })).toBe(
      AUTH_ERROR_MESSAGES.alreadyRegistered,
    );
    expect(friendlyAuthError({ code: "weak_password" })).toBe(
      AUTH_ERROR_MESSAGES.weakPassword,
    );
    expect(friendlyAuthError({ code: "over_email_send_rate_limit" })).toBe(
      AUTH_ERROR_MESSAGES.rateLimited,
    );
    expect(friendlyAuthError({ code: "signup_disabled" })).toBe(
      AUTH_ERROR_MESSAGES.signupDisabled,
    );
    expect(friendlyAuthError({ code: "fetch_error" })).toBe(
      AUTH_ERROR_MESSAGES.network,
    );
  });

  it("falls back to message sniffing", () => {
    expect(friendlyAuthError({ message: "Failed to fetch" })).toBe(
      AUTH_ERROR_MESSAGES.network,
    );
    expect(
      friendlyAuthError({ message: "Invalid login credentials provided" }),
    ).toBe(AUTH_ERROR_MESSAGES.invalidCredentials);
    expect(friendlyAuthError({ message: "Too many requests" })).toBe(
      AUTH_ERROR_MESSAGES.rateLimited,
    );
  });

  it("returns a safe generic message for unknown errors", () => {
    expect(friendlyAuthError({ code: "mystery_code", message: "????" })).toBe(
      AUTH_ERROR_MESSAGES.generic,
    );
    expect(friendlyAuthError(null)).toBe(AUTH_ERROR_MESSAGES.generic);
    expect(friendlyAuthError(undefined)).toBe(AUTH_ERROR_MESSAGES.generic);
  });
});

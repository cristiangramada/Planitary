import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mapReauthError,
  mapPasswordError,
  validatePasswordChange,
  PASSWORD_MIN_LENGTH,
} from "@/lib/account";

/** Builds a minimal Supabase AuthError-like object for testing the mappers. */
function authError(message: string, code?: string) {
  return { message, code };
}

describe("mapReauthError", () => {
  test("maps invalid_credentials to an incorrect-password message", () => {
    assert.match(
      mapReauthError(authError("Invalid login credentials", "invalid_credentials")),
      /current password is incorrect/i
    );
  });

  test("maps a rate-limit code to a rate-limit message, not an incorrect-password message", () => {
    const message = mapReauthError(authError("Request rate limit reached", "over_request_rate_limit"));
    assert.match(message, /too many attempts/i);
    assert.doesNotMatch(message, /incorrect/i);
  });

  test("falls back to an incorrect-password message when no code is present", () => {
    assert.match(mapReauthError(authError("Invalid login credentials")), /current password is incorrect/i);
  });
});

describe("mapPasswordError", () => {
  test("maps weak_password to a weak-password message", () => {
    assert.match(
      mapPasswordError(authError("Password should be at least 8 characters", "weak_password")),
      /too weak/i
    );
  });

  test("maps same_password to a must-differ message", () => {
    assert.match(
      mapPasswordError(authError("New password should be different from the old password", "same_password")),
      /different from your current password/i
    );
  });

  test("maps a rate-limit code correctly", () => {
    assert.match(
      mapPasswordError(authError("Request rate limit reached", "over_request_rate_limit")),
      /too many attempts/i
    );
  });

  test("falls back to a generic message for unrecognized provider errors", () => {
    assert.match(
      mapPasswordError(authError("Something went wrong on our end")),
      /couldn't update your password/i
    );
  });
});

describe("validatePasswordChange", () => {
  test("accepts a valid change", () => {
    assert.equal(validatePasswordChange("oldpass1", "newpass1", "newpass1"), null);
  });

  test("requires the current password", () => {
    assert.match(validatePasswordChange("", "newpass1", "newpass1") ?? "", /current password/i);
  });

  test("requires a new password", () => {
    assert.match(validatePasswordChange("oldpass1", "", "") ?? "", /new password/i);
  });

  test(`enforces a minimum length of ${PASSWORD_MIN_LENGTH} characters`, () => {
    const error = validatePasswordChange("oldpass1", "short1", "short1");
    assert.match(error ?? "", new RegExp(`${PASSWORD_MIN_LENGTH} characters`));
  });

  test("requires the confirmation to match", () => {
    assert.match(
      validatePasswordChange("oldpass1", "newpass1", "different1") ?? "",
      /do not match/i
    );
  });

  test("rejects reusing the current password as the new one", () => {
    assert.match(
      validatePasswordChange("samepass1", "samepass1", "samepass1") ?? "",
      /different from your current password/i
    );
  });
});

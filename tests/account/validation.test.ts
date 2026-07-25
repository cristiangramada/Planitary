import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateNewEmail, validatePasswordChange, PASSWORD_MIN_LENGTH } from "@/lib/account";

describe("validateNewEmail", () => {
  const currentEmail = "cristian@example.com";

  test("accepts a valid, different email", () => {
    assert.equal(validateNewEmail("new@example.com", currentEmail), null);
  });

  test("trims whitespace before comparing", () => {
    assert.equal(validateNewEmail("  new@example.com  ", currentEmail), null);
  });

  test("rejects an empty value", () => {
    assert.match(validateNewEmail("", currentEmail) ?? "", /enter a new email/i);
  });

  test("rejects an invalid email format", () => {
    assert.match(validateNewEmail("not-an-email", currentEmail) ?? "", /valid email/i);
  });

  test("rejects the current email (case-insensitive)", () => {
    assert.match(validateNewEmail("Cristian@Example.com", currentEmail) ?? "", /current email/i);
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

import { describe, expect, it } from "vitest";
import { maskValue } from "./formatters";

describe("maskValue", () => {
  it("masks everything but the last four characters", () => {
    expect(maskValue("987654321012")).toBe("••••••••1012");
    expect(maskValue("attacker@gmail.com")).toBe(
      `${"•".repeat(14)}.com`,
    );
  });

  it("fully masks values that are four characters or shorter", () => {
    expect(maskValue("1234")).toBe("••••");
    expect(maskValue("123")).toBe("••••");
    expect(maskValue("")).toBe("••••");
  });

  it("never leaks the full value", () => {
    for (const value of [
      "9876543210",
      "upi@okhdfcbank",
      "https://bit.ly/3x9kQz",
      "operator@jaal.demo",
    ]) {
      const masked = maskValue(value);
      expect(masked).not.toBe(value);
      expect(masked).not.toContain(value);
    }
  });

  it("keeps the tail so two leads stay distinguishable", () => {
    const value = "9876543210";
    expect(maskValue(value).endsWith(value.slice(-4))).toBe(true);
    expect(maskValue("9876543210").slice(-4)).toBe("3210");
  });

  it("caps the bullet run so the mask does not leak exact length", () => {
    const long = "a".repeat(200);
    const masked = maskValue(long);
    // 16 bullets max + the 4 visible tail characters.
    expect(masked).toBe(`${"•".repeat(16)}${"a".repeat(4)}`);

    const evenLonger = "b".repeat(500);
    expect(maskValue(evenLonger).length).toBe(masked.length);
  });

  it("is stable — masking a masked value does not grow it", () => {
    const once = maskValue("987654321012");
    expect(maskValue(once)).toBe(once);
  });
});

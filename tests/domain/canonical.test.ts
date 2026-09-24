import { describe, expect, it } from "vitest";

import { canonicalJson, digestOf } from "@/domain/canonical";

describe("canonicalJson", () => {
  it("serializes scalars unambiguously", () => {
    expect(canonicalJson(null)).toBe("null");
    expect(canonicalJson(true)).toBe("true");
    expect(canonicalJson(false)).toBe("false");
    expect(canonicalJson(0)).toBe("0");
    expect(canonicalJson(-12.5)).toBe("-12.5");
    expect(canonicalJson("a\"b")).toBe("\"a\\\"b\"");
  });

  it("treats a top-level undefined as null, matching JSON", () => {
    expect(canonicalJson(undefined)).toBe("null");
  });

  it("sorts object keys, so authoring order cannot change the output", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson({ b: 1, a: 2 })).toBe("{\"a\":2,\"b\":1}");
  });

  it("sorts nested keys too", () => {
    expect(canonicalJson({ outer: { z: 1, a: [3, 2] } })).toBe("{\"outer\":{\"a\":[3,2],\"z\":1}}");
  });

  it("preserves array order, because order is content", () => {
    expect(canonicalJson([2, 1])).toBe("[2,1]");
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it("drops undefined object properties and nulls undefined array entries", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe("{\"a\":1}");
    expect(canonicalJson([1, undefined, 2])).toBe("[1,null,2]");
  });

  it("accepts a null-prototype object", () => {
    const bare = Object.create(null) as Record<string, unknown>;
    bare.a = 1;
    expect(canonicalJson(bare)).toBe("{\"a\":1}");
  });

  it("rejects values it could not actually digest", () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(TypeError);
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => canonicalJson(() => 1)).toThrow(TypeError);
    expect(() => canonicalJson(Symbol("x"))).toThrow(TypeError);
    expect(() => canonicalJson(new Date(0))).toThrow(TypeError);
  });
});

describe("digestOf", () => {
  it("is stable for equal content", () => {
    expect(digestOf({ a: 1, b: [2, 3] })).toBe(digestOf({ a: 1, b: [2, 3] }));
    expect(digestOf({ a: 1, b: [2, 3] })).toBe(digestOf({ b: [2, 3], a: 1 }));
  });

  it("changes when content changes", () => {
    expect(digestOf({ a: 1 })).not.toBe(digestOf({ a: 2 }));
    expect(digestOf([1, 2])).not.toBe(digestOf([2, 1]));
  });

  it("produces a short, printable token suitable for a golden fixture", () => {
    const digest = digestOf({ a: 1 });
    expect(digest).toMatch(/^[0-9a-f]{8}$/);
  });
});

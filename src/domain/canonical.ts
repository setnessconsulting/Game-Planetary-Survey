/**
 * Canonical serialization and stable digests.
 *
 * Part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 *
 * Why this exists: PS-03 has to make testable the claim that "same content
 * version + seed produces the same mission facts" (GAME-366). That claim is only
 * checkable if two runs can be compared byte for byte, so serialization must not
 * depend on authoring order, object key insertion order, or the engine's
 * JSON.stringify implementation details.
 *
 * `canonicalJson` therefore sorts object keys recursively and emits stable number
 * formatting. `digestOf` reduces any domain value to a short, stable token that a
 * test or a release manifest can pin as a golden value.
 *
 * Deliberately dependency-free: no JSON replacer ordering tricks, no crypto, no
 * locale-sensitive formatting, and no ambient time.
 */

import { hashToSeed, seedToken } from "./random";

/**
 * Serialize a domain value canonically.
 *
 * Differences from `JSON.stringify`:
 *  - object keys are sorted, so `{a, b}` and `{b, a}` serialize identically;
 *  - numbers use `String(number)`, which is locale-independent and exact for the
 *    finite values this contract allows;
 *  - `undefined` object properties are dropped (matching JSON), and a `undefined`
 *    value inside an array becomes `null` (also matching JSON) rather than
 *    shifting positions;
 *  - functions, symbols, and class instances are rejected loudly, because
 *    silently serializing them would mean the digest does not actually cover the
 *    value being digested.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";

  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) {
        throw new TypeError(`canonicalJson cannot serialize a non-finite number: ${value}`);
      }
      return String(value);
    case "string":
      return JSON.stringify(value);
    case "undefined":
      return "null";
    case "object":
      break;
    default:
      throw new TypeError(`canonicalJson cannot serialize a ${typeof value}`);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError("canonicalJson only serializes plain objects");
  }

  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const entry = record[key];
    if (entry === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalJson(entry)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * A short, stable digest of any canonicalizable domain value.
 *
 * Used to pin golden fixtures and to record which exact content a rendered or
 * cached artifact was derived from (docs/SCIENCE_MODEL.md §5.3). It is an
 * integrity/identity token, not a security primitive.
 */
export function digestOf(value: unknown): string {
  return seedToken(hashToSeed(canonicalJson(value)));
}

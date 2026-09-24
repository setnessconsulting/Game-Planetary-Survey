/**
 * Units, typed quantities, and deterministic formatting.
 *
 * This module is part of the pure domain layer (docs/TECHNICAL_DESIGN.md §3).
 * It must not import React, Babylon, DOM/browser APIs, or another layer.
 *
 * Contractual rules enforced here:
 *  - a bare `number` never crosses the domain boundary; values carry their unit
 *    (docs/SCIENCE_MODEL.md §6);
 *  - displayed precision is derived from the source, not chosen for looks;
 *  - formatting is deterministic and locale-independent, so a golden fixture
 *    produces identical text in every environment and on every renderer.
 */

/** Units the v1 science contract may display. */
export type Unit = "m" | "km" | "K" | "degC";

/** A value bound to its unit. Never construct one without a unit. */
export interface Quantity<U extends Unit = Unit> {
  readonly value: number;
  readonly unit: U;
}

export const quantity = <U extends Unit>(value: number, unit: U): Quantity<U> => ({
  value,
  unit,
});

export const metres = (value: number): Quantity<"m"> => quantity(value, "m");
export const kilometres = (value: number): Quantity<"km"> => quantity(value, "km");
export const kelvin = (value: number): Quantity<"K"> => quantity(value, "K");
export const celsius = (value: number): Quantity<"degC"> => quantity(value, "degC");

const METRES_PER_KILOMETRE = 1000;

export function isLengthUnit(unit: Unit): unit is "m" | "km" {
  return unit === "m" || unit === "km";
}

export function isTemperatureUnit(unit: Unit): unit is "K" | "degC" {
  return unit === "K" || unit === "degC";
}

/**
 * Convert a quantity into a requested unit of the same kind.
 *
 * Throws on a cross-kind conversion (a length to a temperature): that is a
 * programming error, and silently coercing it would risk a wrong number
 * reaching a learner.
 */
export function convertTo(value: Quantity, unit: Unit): Quantity {
  if (isLengthUnit(value.unit) && isLengthUnit(unit)) {
    const inMetres = toMetres(quantity(value.value, value.unit)).value;
    return unit === "m" ? quantity(inMetres, "m") : quantity(inMetres / METRES_PER_KILOMETRE, "km");
  }
  if (isTemperatureUnit(value.unit) && isTemperatureUnit(unit)) {
    const inKelvin = toKelvin(quantity(value.value, value.unit)).value;
    return unit === "K" ? quantity(inKelvin, "K") : quantity(inKelvin - 273.15, "degC");
  }
  throw new TypeError(`Cannot convert ${value.unit} to ${unit}: different measurement kinds.`);
}

/**
 * Convert a length to metres. The only place length conversion is allowed to
 * happen; comparisons always use this canonical form.
 */
export function toMetres(value: Quantity<"m" | "km">): Quantity<"m"> {
  return value.unit === "m"
    ? quantity(value.value, "m")
    : quantity(value.value * METRES_PER_KILOMETRE, "m");
}

/** Convert a length to kilometres. */
export function toKilometres(value: Quantity<"m" | "km">): Quantity<"km"> {
  return value.unit === "km"
    ? quantity(value.value, "km")
    : quantity(value.value / METRES_PER_KILOMETRE, "km");
}

/**
 * Canonical magnitude of a quantity, in its base unit.
 *
 * Only same-kind conversions are permitted; mixing a length with a temperature
 * is a programming error rather than a runtime fallback.
 */
export function canonicalMagnitude(value: Quantity): number {
  switch (value.unit) {
    case "m":
    case "km":
      return toMetres(quantity(value.value, value.unit)).value;
    case "K":
    case "degC":
      return toKelvin(quantity(value.value, value.unit)).value;
    default: {
      const unreachable: never = value.unit;
      return unreachable;
    }
  }
}

/** Convert a temperature to kelvin. */
export function toKelvin(value: Quantity<"K" | "degC">): Quantity<"K"> {
  return value.unit === "K" ? quantity(value.value, "K") : quantity(value.value + 273.15, "K");
}

export function toCelsius(value: Quantity<"K" | "degC">): Quantity<"degC"> {
  return value.unit === "degC" ? quantity(value.value, "degC") : quantity(value.value - 273.15, "degC");
}

/**
 * Round to a number of significant digits.
 *
 * Used to honour `SourcedValue.significantDigits`: the game may not display more
 * precision than the source supports (docs/SCIENCE_MODEL.md §6).
 */
export function roundSignificant(value: number, significantDigits: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const digits = Math.max(1, Math.min(21, Math.trunc(significantDigits)));
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = 10 ** (digits - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

/** Deterministic thousands-separated number formatting (no locale dependence). */
export function formatNumber(value: number, fractionDigits = 0): string {
  const digits = Math.max(0, Math.min(20, Math.trunc(fractionDigits)));
  const fixed = Math.abs(value).toFixed(digits);
  const [wholePart = "0", fractionPart] = fixed.split(".");
  const grouped = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const sign = value < 0 ? "-" : "";
  return fractionPart ? `${sign}${grouped}.${fractionPart}` : `${sign}${grouped}`;
}

/**
 * Render a quantity as learner-facing text.
 *
 * Precision is taken from the caller (the source register), never invented here.
 */
export function formatQuantity(value: Quantity, significantDigits: number): string {
  const magnitude = Math.abs(value.value);
  const integerDigits = magnitude >= 1 ? Math.floor(Math.log10(magnitude)) + 1 : 1;
  const fractionDigits = Math.max(0, significantDigits - integerDigits);
  const rounded = roundSignificant(value.value, significantDigits);
  return `${formatNumber(rounded, fractionDigits)} ${value.unit}`;
}

/** Ordering of two same-kind quantities, compared in canonical units. */
export function compareQuantities(left: Quantity, right: Quantity): -1 | 0 | 1 {
  const a = canonicalMagnitude(left);
  const b = canonicalMagnitude(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

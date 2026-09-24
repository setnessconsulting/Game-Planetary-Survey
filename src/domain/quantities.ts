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

/**
 * Units the v1 science contract may display.
 *
 * `ratio` and `percent` are the units of *normalized* values. MS-ESS1-3 asks the
 * learner to interpret a proportion rather than a raw magnitude, so a proportion
 * is a first-class unit-typed value rather than a bare number
 * (docs/SCIENCE_MODEL.md §6).
 */
export type Unit = "m" | "km" | "K" | "degC" | "ratio" | "percent";

/** A dimension of measurement. Two quantities are comparable only within one kind. */
export type UnitKind = "length" | "temperature" | "dimensionless";

/** A value bound to its unit. Never construct one without a unit. */
export interface Quantity<U extends Unit = Unit> {
  readonly value: number;
  readonly unit: U;
}

/**
 * Everything the domain knows about one unit.
 *
 * Keeping this as data means there is exactly one definition of every conversion
 * factor and one definition of which unit is canonical, so "canonical" cannot
 * drift apart from "what conversion does" (docs/SCIENCE_MODEL.md §6).
 */
export interface UnitDefinition {
  readonly id: Unit;
  readonly kind: UnitKind;
  /** Learner-readable unit name, used in explanatory text. */
  readonly label: string;
  /**
   * True for the SI base unit of the kind (metre, kelvin). Normalized and
   * comparative values are always computed in the SI base unit.
   */
  readonly siBase: boolean;
  /** numeric value in this unit -> numeric value in the SI base unit of its kind. */
  readonly toBase: (value: number) => number;
  /** numeric value in the SI base unit of its kind -> numeric value in this unit. */
  readonly fromBase: (value: number) => number;
}

const KELVIN_OFFSET = 273.15;

/** The unit registry. The only place a conversion factor is written down. */
export const UNITS: Readonly<Record<Unit, UnitDefinition>> = {
  m: {
    id: "m",
    kind: "length",
    label: "metres",
    siBase: true,
    toBase: (value) => value,
    fromBase: (value) => value,
  },
  km: {
    id: "km",
    kind: "length",
    label: "kilometres",
    siBase: false,
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000,
  },
  K: {
    id: "K",
    kind: "temperature",
    label: "kelvin",
    siBase: true,
    toBase: (value) => value,
    fromBase: (value) => value,
  },
  degC: {
    id: "degC",
    kind: "temperature",
    label: "degrees Celsius",
    siBase: false,
    toBase: (value) => value + KELVIN_OFFSET,
    fromBase: (value) => value - KELVIN_OFFSET,
  },
  ratio: {
    id: "ratio",
    kind: "dimensionless",
    label: "times",
    siBase: true,
    toBase: (value) => value,
    fromBase: (value) => value,
  },
  percent: {
    id: "percent",
    kind: "dimensionless",
    label: "per cent",
    siBase: false,
    toBase: (value) => value / 100,
    fromBase: (value) => value * 100,
  },
};

export const UNIT_IDS = Object.keys(UNITS) as readonly Unit[];

/** The SI base unit for a kind. Storage/comparison canonical form. */
const SI_BASE_UNITS: Readonly<Record<UnitKind, Unit>> = {
  length: "m",
  temperature: "K",
  dimensionless: "ratio",
};

/**
 * Units a learner may reasonably be shown, most familiar first.
 *
 * Presentation choice only: switching the displayed unit changes the text, never
 * the stored value (docs/SCIENCE_MODEL.md §6).
 */
const LEARNER_FACING_UNITS: Readonly<Record<UnitKind, readonly Unit[]>> = {
  length: ["km", "m"],
  temperature: ["degC", "K"],
  dimensionless: ["percent", "ratio"],
};

export const quantity = <U extends Unit>(value: number, unit: U): Quantity<U> => ({
  value,
  unit,
});

export const metres = (value: number): Quantity<"m"> => quantity(value, "m");
export const kilometres = (value: number): Quantity<"km"> => quantity(value, "km");
export const kelvin = (value: number): Quantity<"K"> => quantity(value, "K");
export const celsius = (value: number): Quantity<"degC"> => quantity(value, "degC");
export const ratio = (value: number): Quantity<"ratio"> => quantity(value, "ratio");
export const percent = (value: number): Quantity<"percent"> => quantity(value, "percent");

export function unitDefinition(unit: Unit): UnitDefinition {
  return UNITS[unit];
}

export function unitKind(unit: Unit): UnitKind {
  return UNITS[unit].kind;
}

export function siBaseUnitFor(kind: UnitKind): Unit {
  return SI_BASE_UNITS[kind];
}

export function isSiBaseUnit(unit: Unit): boolean {
  return UNITS[unit].siBase;
}

export function learnerFacingUnits(kind: UnitKind): readonly Unit[] {
  return LEARNER_FACING_UNITS[kind];
}

/** True when two units measure the same kind, and so may be compared at all. */
export function unitsAreComparable(left: Unit, right: Unit): boolean {
  return UNITS[left].kind === UNITS[right].kind;
}

export function isLengthUnit(unit: Unit): unit is "m" | "km" {
  return UNITS[unit].kind === "length";
}

export function isTemperatureUnit(unit: Unit): unit is "K" | "degC" {
  return UNITS[unit].kind === "temperature";
}

/**
 * Convert a quantity into a requested unit of the same kind.
 *
 * Throws on a cross-kind conversion (a length to a temperature): that is a
 * programming error, and silently coercing it would risk a wrong number
 * reaching a learner.
 */
export function convertTo(value: Quantity, unit: Unit): Quantity {
  const from = UNITS[value.unit];
  const to = UNITS[unit];
  if (from.kind !== to.kind) {
    throw new TypeError(`Cannot convert ${value.unit} to ${unit}: different measurement kinds.`);
  }
  return quantity(to.fromBase(from.toBase(value.value)), unit);
}

/**
 * Convert a length to metres, the SI base unit for length. Comparisons and
 * normalized values always use this canonical form.
 */
export function toMetres(value: Quantity<"m" | "km">): Quantity<"m"> {
  return convertTo(value, "m") as Quantity<"m">;
}

/** Convert a length to kilometres. */
export function toKilometres(value: Quantity<"m" | "km">): Quantity<"km"> {
  return convertTo(value, "km") as Quantity<"km">;
}

/**
 * Canonical (SI base unit) magnitude of a quantity.
 *
 * Every quantity has exactly one canonical magnitude, so two same-kind values in
 * different units are comparable without either caller choosing a unit.
 */
export function canonicalMagnitude(value: Quantity): number {
  return UNITS[value.unit].toBase(value.value);
}

/** Convert a temperature to kelvin, the SI base unit for temperature. */
export function toKelvin(value: Quantity<"K" | "degC">): Quantity<"K"> {
  return convertTo(value, "K") as Quantity<"K">;
}

export function toCelsius(value: Quantity<"K" | "degC">): Quantity<"degC"> {
  return convertTo(value, "degC") as Quantity<"degC">;
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
 * How many decimal places are needed to show a given number of significant
 * digits of a value.
 *
 * Derived from the value's own magnitude, so the same rule works above and below
 * one. A percentage needs this: a proportion of 0.00025 has to stay readable as
 * "0.025%", and an integer-digit rule would round it to nothing.
 */
export function decimalPlacesFor(value: number, significantDigits: number): number {
  if (!Number.isFinite(value) || value === 0) return 0;
  const digits = Math.max(1, Math.min(21, Math.trunc(significantDigits)));
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  return Math.max(0, digits - 1 - exponent);
}

/**
 * Render a quantity as learner-facing text.
 *
 * Precision is taken from the caller (the source register), never invented here.
 */
export function formatQuantity(value: Quantity, significantDigits: number): string {
  const rounded = roundSignificant(value.value, significantDigits);
  return `${formatNumber(rounded, decimalPlacesFor(rounded, significantDigits))} ${value.unit}`;
}

/** Ordering of two same-kind quantities, compared in canonical units. */
export function compareQuantities(left: Quantity, right: Quantity): -1 | 0 | 1 {
  const a = canonicalMagnitude(left);
  const b = canonicalMagnitude(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

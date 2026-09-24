/**
 * Unit and normalization contract tests (GAME-366).
 *
 * These pin the PS-03 requirement of "canonical SI/base units plus learner-facing
 * conversions": every unit the contract may display declares its kind, whether it
 * is the SI base unit, and both directions of its conversion, and the registry is
 * the only place a conversion factor exists.
 */

import { describe, expect, it } from "vitest";

import {
  UNITS,
  UNIT_IDS,
  celsius,
  canonicalMagnitude,
  convertTo,
  isLengthUnit,
  isSiBaseUnit,
  isTemperatureUnit,
  kelvin,
  kilometres,
  learnerFacingUnits,
  metres,
  percent,
  quantity,
  ratio,
  siBaseUnitFor,
  toCelsius,
  toKelvin,
  toKilometres,
  toMetres,
  unitDefinition,
  unitKind,
  unitsAreComparable,
  type Unit,
  type UnitKind,
} from "@/domain/quantities";

const KINDS: readonly UnitKind[] = ["length", "temperature", "dimensionless"];

describe("the unit registry", () => {
  it("declares exactly the units the science contract may display", () => {
    expect([...UNIT_IDS].sort()).toEqual(["K", "degC", "km", "m", "percent", "ratio"]);
  });

  it("is self-consistent: every definition matches its key", () => {
    for (const id of UNIT_IDS) {
      expect(UNITS[id].id, `${id} definition id`).toBe(id);
      expect(unitDefinition(id)).toBe(UNITS[id]);
      expect(unitKind(id)).toBe(UNITS[id].kind);
    }
  });

  it("declares exactly one SI base unit per kind", () => {
    for (const kind of KINDS) {
      const base = UNIT_IDS.filter((id) => UNITS[id].kind === kind && UNITS[id].siBase);
      expect(base, `base units for ${kind}`).toEqual([siBaseUnitFor(kind)]);
      expect(isSiBaseUnit(siBaseUnitFor(kind))).toBe(true);
    }
  });

  it("names metres and kelvin as the SI base units", () => {
    expect(siBaseUnitFor("length")).toBe("m");
    expect(siBaseUnitFor("temperature")).toBe("K");
    expect(siBaseUnitFor("dimensionless")).toBe("ratio");
    expect(isSiBaseUnit("km")).toBe(false);
    expect(isSiBaseUnit("degC")).toBe(false);
    expect(isSiBaseUnit("percent")).toBe(false);
  });

  it("offers a learner-facing unit per kind, most familiar first", () => {
    expect(learnerFacingUnits("length")).toEqual(["km", "m"]);
    expect(learnerFacingUnits("temperature")).toEqual(["degC", "K"]);
    expect(learnerFacingUnits("dimensionless")).toEqual(["percent", "ratio"]);
  });

  it("round-trips every unit through its own base conversion", () => {
    for (const id of UNIT_IDS) {
      const definition = UNITS[id];
      const value = 42.5;
      const base = definition.toBase(value);
      expect(definition.fromBase(base), `${id} round-trip`).toBeCloseTo(value, 10);
    }
  });

  it("compares units by kind, not by name", () => {
    expect(unitsAreComparable("m", "km")).toBe(true);
    expect(unitsAreComparable("K", "degC")).toBe(true);
    expect(unitsAreComparable("ratio", "percent")).toBe(true);
    expect(unitsAreComparable("km", "K")).toBe(false);
    expect(unitsAreComparable("ratio", "km")).toBe(false);
  });
});

describe("quantity kind guards", () => {
  it("recognises length units and rejects the others", () => {
    expect(isLengthUnit("m")).toBe(true);
    expect(isLengthUnit("km")).toBe(true);
    expect(isLengthUnit("K")).toBe(false);
    expect(isLengthUnit("percent")).toBe(false);
  });

  it("recognises temperature units and rejects the others", () => {
    expect(isTemperatureUnit("K")).toBe(true);
    expect(isTemperatureUnit("degC")).toBe(true);
    expect(isTemperatureUnit("km")).toBe(false);
    expect(isTemperatureUnit("ratio")).toBe(false);
  });
});

describe("convertTo", () => {
  it("converts lengths in both directions", () => {
    expect(convertTo(kilometres(3), "m").value).toBe(3000);
    expect(convertTo(metres(3000), "km").value).toBe(3);
    expect(convertTo(metres(3000), "m").value).toBe(3000);
    expect(convertTo(kilometres(3), "km").value).toBe(3);
  });

  it("converts temperatures in both directions", () => {
    expect(convertTo(kelvin(300), "degC").value).toBeCloseTo(26.85, 10);
    expect(convertTo(celsius(0), "K").value).toBeCloseTo(273.15, 10);
  });

  it("converts between a ratio and a percentage", () => {
    expect(convertTo(ratio(0.25), "percent").value).toBeCloseTo(25, 10);
    expect(convertTo(percent(25), "ratio").value).toBeCloseTo(0.25, 10);
  });

  it("refuses a cross-kind conversion rather than coercing it", () => {
    expect(() => convertTo(kilometres(3), "K")).toThrow(TypeError);
    expect(() => convertTo(kelvin(300), "km")).toThrow(TypeError);
    expect(() => convertTo(kelvin(300), "ratio")).toThrow(TypeError);
    expect(() => convertTo(ratio(1), "m")).toThrow(TypeError);
  });
});

describe("directional helpers", () => {
  it("converts to metres and keeps metres unchanged", () => {
    expect(toMetres(kilometres(2)).value).toBe(2000);
    expect(toMetres(metres(7)).value).toBe(7);
  });

  it("converts to kilometres and keeps kilometres unchanged", () => {
    expect(toKilometres(metres(2500)).value).toBe(2.5);
    expect(toKilometres(kilometres(7)).value).toBe(7);
  });

  it("converts to kelvin and back to Celsius", () => {
    expect(toKelvin(celsius(0)).value).toBeCloseTo(273.15, 10);
    expect(toKelvin(kelvin(0)).value).toBe(0);
    expect(toCelsius(kelvin(273.15)).value).toBeCloseTo(0, 10);
    expect(toCelsius(celsius(-40)).value).toBe(-40);
  });
});

describe("canonicalMagnitude", () => {
  it("reports the SI base magnitude of every unit", () => {
    const cases: readonly (readonly [Unit, number, number])[] = [
      ["m", 2500, 2500],
      ["km", 2.5, 2500],
      ["K", 300, 300],
      ["degC", 0, 273.15],
      ["ratio", 0.5, 0.5],
      ["percent", 50, 0.5],
    ];
    for (const [unit, value, expected] of cases) {
      expect(canonicalMagnitude(quantity(value, unit)), `${value} ${unit}`).toBeCloseTo(expected, 10);
    }
  });

  it("gives the same canonical magnitude for the same quantity in two units", () => {
    expect(canonicalMagnitude(quantity(2, "km"))).toBe(canonicalMagnitude(quantity(2000, "m")));
  });
});

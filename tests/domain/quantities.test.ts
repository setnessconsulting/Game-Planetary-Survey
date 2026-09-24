import { describe, expect, it } from "vitest";

import {
  canonicalMagnitude,
  celsius,
  compareQuantities,
  convertTo,
  formatNumber,
  formatQuantity,
  kelvin,
  kilometres,
  metres,
  quantity,
  roundSignificant,
  toCelsius,
  toKelvin,
  toKilometres,
  toMetres,
} from "@/domain/quantities";

describe("length conversion", () => {
  it("converts kilometres to metres and back", () => {
    expect(toMetres(kilometres(2)).value).toBe(2000);
    expect(toKilometres(metres(2500)).value).toBe(2.5);
  });

  it("is idempotent within the same unit", () => {
    expect(toMetres(metres(7)).value).toBe(7);
    expect(toKilometres(kilometres(7)).value).toBe(7);
  });
});

describe("temperature conversion", () => {
  it("converts between kelvin and celsius", () => {
    expect(toKelvin(celsius(0)).value).toBeCloseTo(273.15, 10);
    expect(toCelsius(kelvin(273.15)).value).toBeCloseTo(0, 10);
  });
});

describe("convertTo", () => {
  it("converts within a measurement kind", () => {
    expect(convertTo(kilometres(3), "m").value).toBe(3000);
    expect(convertTo(metres(3000), "km").value).toBe(3);
    expect(convertTo(kelvin(300), "degC").value).toBeCloseTo(26.85, 10);
  });

  it("refuses to convert across measurement kinds", () => {
    expect(() => convertTo(kilometres(3), "K")).toThrow(TypeError);
    expect(() => convertTo(kelvin(300), "km")).toThrow(TypeError);
  });
});

describe("canonicalMagnitude", () => {
  it("normalizes to the canonical base unit of each kind", () => {
    expect(canonicalMagnitude(kilometres(2))).toBe(2000);
    expect(canonicalMagnitude(metres(2500))).toBe(2500);
    expect(canonicalMagnitude(kelvin(300))).toBe(300);
  });
});

describe("roundSignificant", () => {
  it("honours the requested significant digits", () => {
    expect(roundSignificant(1234.5678, 3)).toBe(1230);
    expect(roundSignificant(1234.5678, 6)).toBe(1234.57);
    expect(roundSignificant(0.00123456, 2)).toBeCloseTo(0.0012, 10);
  });

  it("passes through zero and non-finite values unchanged", () => {
    expect(roundSignificant(0, 3)).toBe(0);
    expect(Number.isNaN(roundSignificant(Number.NaN, 3))).toBe(true);
  });
});

describe("formatNumber", () => {
  it("groups thousands deterministically without locale dependence", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
    expect(formatNumber(-1234567)).toBe("-1,234,567");
    expect(formatNumber(999)).toBe("999");
  });

  it("respects the requested fraction digits", () => {
    expect(formatNumber(1234.5, 2)).toBe("1,234.50");
    expect(formatNumber(0.5, 1)).toBe("0.5");
  });
});

describe("formatQuantity", () => {
  it("derives display precision from the source precision, not from appearance", () => {
    expect(formatQuantity(kilometres(6371.0084), 4)).toBe("6,371 km");
    expect(formatQuantity(kilometres(6371.0084), 6)).toBe("6,371.01 km");
    expect(formatQuantity(quantity(2.5, "m"), 2)).toBe("2.5 m");
  });

  it("always includes the unit, because a bare number may not reach a learner", () => {
    expect(formatQuantity(kelvin(288), 3)).toContain("K");
    expect(formatQuantity(kilometres(1), 3)).toContain("km");
  });
});

describe("compareQuantities", () => {
  it("compares within a kind, in canonical units", () => {
    expect(compareQuantities(kilometres(1), metres(999))).toBe(1);
    expect(compareQuantities(metres(999), kilometres(1))).toBe(-1);
    expect(compareQuantities(metres(1000), kilometres(1))).toBe(0);
  });
});

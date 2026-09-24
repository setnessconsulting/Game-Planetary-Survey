import { describe, expect, it } from "vitest";

import {
  detectCapabilities,
  explainUnavailable,
  unavailableReport,
  type CapabilityProbe,
} from "@/platform/capabilities";

const webgpuProbe: CapabilityProbe = {
  hasWebGPU: () => true,
  probeWebGL2: () => ({ supported: true, maxTextureSize: 16384 }),
};

const webgl2OnlyProbe: CapabilityProbe = {
  hasWebGPU: () => false,
  probeWebGL2: () => ({ supported: true, maxTextureSize: 8192 }),
};

const nothingProbe: CapabilityProbe = {
  hasWebGPU: () => false,
  probeWebGL2: () => ({ supported: false, maxTextureSize: null }),
};

describe("detectCapabilities", () => {
  it("prefers WebGPU when it is available, keeping WebGL2 as the recorded baseline", () => {
    const report = detectCapabilities(webgpuProbe);
    expect(report.backend).toBe("webgpu");
    expect(report.webgpu).toBe(true);
    expect(report.webgl2).toBe(true);
    expect(report.notes.join(" ")).toContain("WebGL2 remains the correctness baseline");
  });

  it("uses WebGL2 when WebGPU is absent", () => {
    const report = detectCapabilities(webgl2OnlyProbe);
    expect(report.backend).toBe("webgl2");
    expect(report.webgl2).toBe(true);
    expect(report.maxTextureSize).toBe(8192);
  });

  it("reports unavailable when neither backend exists, rather than guessing", () => {
    const report = detectCapabilities(nothingProbe);
    expect(report.backend).toBe("unavailable");
    expect(report.webgpu).toBe(false);
    expect(report.webgl2).toBe(false);
  });

  it("is exception-safe: a throwing probe degrades instead of breaking startup", () => {
    const report = detectCapabilities({
      hasWebGPU: () => {
        throw new Error("navigator.gpu exploded");
      },
      probeWebGL2: () => {
        throw new Error("context creation exploded");
      },
    });
    expect(report.backend).toBe("unavailable");
    expect(report.notes.join(" ")).toContain("WebGPU detection failed");
    expect(report.notes.join(" ")).toContain("WebGL2 detection failed");
  });

  it("survives a probe that claims WebGPU but reports no WebGL2", () => {
    const report = detectCapabilities({
      hasWebGPU: () => true,
      probeWebGL2: () => ({ supported: false, maxTextureSize: null }),
    });
    expect(report.backend).toBe("webgpu");
    expect(report.webgl2).toBe(false);
  });
});

describe("honest failure reporting", () => {
  it("explains the unavailable state and points at the accessible route", () => {
    const message = explainUnavailable(unavailableReport(["Neither WebGL2 nor WebGPU is available."]));
    expect(message).toContain("cannot start the 3D survey view");
    expect(message).toContain("evidence notebook");
    expect(message).toContain("3D view is an enhancement, not the source of the science");
  });

  it("never returns an empty explanation", () => {
    expect(explainUnavailable(unavailableReport([])).length).toBeGreaterThan(50);
  });
});

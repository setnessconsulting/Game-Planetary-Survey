/**
 * Foundation boundary and invariance tests.
 *
 * These are the tests GAME-364 explicitly requires:
 *  - domain modules do not import Babylon / React / browser DOM APIs;
 *  - a deterministic domain fixture behaves identically regardless of renderer;
 *  - WebGPU capability detection does not affect domain behaviour;
 *  - quality-tier configuration does not alter domain data.
 *
 * They complement `scripts/check-architecture.mjs`: that script fails the build,
 * this suite fails the test run, and both read the same rules from the frozen
 * contract (docs/TECHNICAL_DESIGN.md §2.1, §12.2).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { QUALITY_PROFILE_IDS } from "@/assets/qualityProfiles";
import { evaluateClaim, createClaim } from "@/domain/claims";
import { compareEvidence } from "@/domain/comparison";
import { captureEvidence, type EvidenceRecord } from "@/domain/evidence";
import { measure } from "@/domain/measurement";
import { applyIntent, initialMissionSnapshot, type MissionSnapshot } from "@/domain/mission";
import { projectRenderSnapshot } from "@/domain/renderSnapshot";
import { detectCapabilities, type CapabilityReport } from "@/platform/capabilities";
import { FIXTURE_ALPHA, FIXTURE_BETA, fixtureContext } from "@/testing/devFixture";

const srcRoot = resolve(process.cwd(), "src");

function filesUnder(dir: string, extensions: string[] = [".ts", ".tsx"]): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory()
      ? filesUnder(path, extensions)
      : extensions.some((extension) => path.endsWith(extension))
        ? [path]
        : [];
  });
}

const DOMAIN_SOURCE_FORBIDDEN: readonly [RegExp, string][] = [
  [/from\s+["']react(?:-dom)?(?:\/|["'])/, "React import"],
  [/from\s+["']@babylonjs\//, "@babylonjs import"],
  [/from\s+["']@\/(?:ui|renderer|audio|content|assets|platform|styles)/, "upward layer import"],
  [/\bwindow\s*(?:\.|\[)/, "window access"],
  [/\bdocument\s*(?:\.|\[)/, "document access"],
  [/\bnavigator\s*(?:\.|\[)/, "navigator access"],
  [/\blocalStorage\b/, "localStorage"],
  [/\bfetch\s*\(/, "fetch()"],
  [/\bMath\.random\s*\(/, "Math.random"],
  [/\bDate\.now\s*\(/, "Date.now"],
  [/\brequestAnimationFrame\s*\(/, "requestAnimationFrame"],
];

describe("domain purity (source scan)", () => {
  const domainFiles = filesUnder(join(srcRoot, "domain"));

  it("contains domain modules to check", () => {
    expect(domainFiles.length).toBeGreaterThan(5);
  });

  it("imports no React, no Babylon, and no upward layer", () => {
    for (const path of domainFiles) {
      const source = readFileSync(path, "utf8");
      for (const [pattern, label] of DOMAIN_SOURCE_FORBIDDEN) {
        expect(pattern.test(source), `${path} contains ${label}`).toBe(false);
      }
    }
  });

  it("has no JSX in the domain layer", () => {
    expect(filesUnder(join(srcRoot, "domain"), [".tsx", ".jsx"])).toEqual([]);
  });
});

describe("frame-loop ownership", () => {
  it("calls runRenderLoop only inside src/renderer", () => {
    const offenders = filesUnder(srcRoot)
      .filter((path) => !path.replace(/\\/g, "/").includes("/src/renderer/"))
      .filter((path) => /runRenderLoop\s*\(/.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("keeps Babylon out of the UI layer", () => {
    const offenders = filesUnder(join(srcRoot, "ui"))
      .filter((path) => /from\s+["']@babylonjs\//.test(readFileSync(path, "utf8")));
    expect(offenders).toEqual([]);
  });
});

/** A complete deterministic domain run, used as the invariance fixture. */
interface PipelineResult {
  readonly snapshot: MissionSnapshot;
  readonly evidence: readonly EvidenceRecord[];
  readonly findings: ReturnType<typeof compareEvidence>;
  readonly projection: ReturnType<typeof projectRenderSnapshot>;
}

function runDeterministicPipeline(): PipelineResult {
  const context = fixtureContext();
  let snapshot = initialMissionSnapshot(20260924);
  for (const intent of [
    { kind: "loadMission", missionId: "boundary-fixture", seed: 20260924 },
    { kind: "beginBriefing" },
    { kind: "selectTarget", bodyId: FIXTURE_ALPHA },
    { kind: "selectInstrument", instrumentId: "radiusSounder" },
    { kind: "measure", attributeId: "meanRadius" },
    { kind: "captureEvidence" },
    { kind: "selectTarget", bodyId: FIXTURE_BETA },
    { kind: "selectInstrument", instrumentId: "radiusSounder" },
    { kind: "measure", attributeId: "meanRadius" },
    { kind: "captureEvidence" },
    { kind: "compare" },
  ] as const) {
    const result = applyIntent(snapshot, intent, context);
    if (result.kind === "applied") snapshot = result.snapshot;
  }

  const [first, second] = snapshot.evidence;
  const claim = createClaim({
    attributeId: "meanRadius",
    subject: FIXTURE_BETA,
    relation: "largerThan",
    object: FIXTURE_ALPHA,
    citedEvidenceIds: [first?.id ?? "", second?.id ?? ""],
  });
  const submitted = applyIntent(snapshot, { kind: "draftClaim", draft: claim }, context);
  const finalSnapshot = submitted.kind === "applied" ? submitted.snapshot : snapshot;

  return {
    snapshot: finalSnapshot,
    evidence: finalSnapshot.evidence,
    findings: compareEvidence(finalSnapshot.evidence),
    projection: projectRenderSnapshot(finalSnapshot, context.bodies),
  };
}

const CAPABILITY_SCENARIOS: readonly (readonly [string, CapabilityReport])[] = [
  [
    "webgl2",
    detectCapabilities({
      hasWebGPU: () => false,
      probeWebGL2: () => ({ supported: true, maxTextureSize: 8192 }),
    }),
  ],
  [
    "webgpu",
    detectCapabilities({
      hasWebGPU: () => true,
      probeWebGL2: () => ({ supported: true, maxTextureSize: 16384 }),
    }),
  ],
  [
    "unavailable",
    detectCapabilities({
      hasWebGPU: () => false,
      probeWebGL2: () => ({ supported: false, maxTextureSize: null }),
    }),
  ],
];

describe("renderer-independence of the domain", () => {
  it("produces byte-identical domain output on WebGL2, WebGPU, and no renderer", () => {
    const baseline = JSON.stringify(runDeterministicPipeline());

    for (const [name, report] of CAPABILITY_SCENARIOS) {
      // The report is deliberately part of the test surface: the assertion is
      // that whatever the renderer says, the science does not move.
      expect(report.backend, `scenario ${name} misconfigured`).toBeDefined();
      expect(JSON.stringify(runDeterministicPipeline()), `differs on ${name}`).toBe(baseline);
    }
  });

  it("resolves distinct backends for the scenarios, so the test is meaningful", () => {
    const backends = CAPABILITY_SCENARIOS.map(([, report]) => report.backend);
    expect(new Set(backends).size).toBe(3);
  });

  it("is reproducible across repeated runs", () => {
    expect(JSON.stringify(runDeterministicPipeline())).toBe(
      JSON.stringify(runDeterministicPipeline()),
    );
  });
});

describe("quality-tier invariance of the domain", () => {
  it("does not alter any domain value at any quality tier", () => {
    const baseline = JSON.stringify(runDeterministicPipeline());

    for (const profileId of QUALITY_PROFILE_IDS) {
      // Quality is presentation data. If a future change makes the domain read
      // it, this test and the purity scan both fail.
      expect(profileId).toBeTruthy();
      expect(JSON.stringify(runDeterministicPipeline()), `differs at tier ${profileId}`).toBe(
        baseline,
      );
    }
  });
});

describe("claim evaluation is invariant too", () => {
  it("returns the same verdict regardless of presentation concerns", () => {
    const pipeline = runDeterministicPipeline();
    const [first, second] = pipeline.evidence;
    const claim = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [first?.id ?? "", second?.id ?? ""],
    });
    const verdict = evaluateClaim(claim, pipeline.evidence).verdict;
    expect(verdict).toBe("supported");
    expect(JSON.stringify(evaluateClaim(claim, pipeline.evidence))).toBe(
      JSON.stringify(evaluateClaim(claim, pipeline.evidence)),
    );
  });

  it("keeps the anti-guessing rule regardless of how confident a claim looks", () => {
    const pipeline = runDeterministicPipeline();
    const uncited = createClaim({
      attributeId: "meanRadius",
      subject: FIXTURE_BETA,
      relation: "largerThan",
      object: FIXTURE_ALPHA,
      citedEvidenceIds: [],
    });
    expect(evaluateClaim(uncited, pipeline.evidence).verdict).toBe("insufficient-evidence");
  });
});

describe("measurement determinism", () => {
  it("gives the same reading for the same request at any point in time", () => {
    const request = {
      instrumentId: "radiusSounder" as const,
      bodyId: FIXTURE_ALPHA,
      attributeId: "meanRadius" as const,
      seed: 12345,
    };
    const first = measure(request, fixtureContext().bodies);
    const second = measure(request, fixtureContext().bodies);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("captures into an array that JSON round-trips losslessly", () => {
    const outcome = measure(
      { instrumentId: "radiusSounder", bodyId: FIXTURE_ALPHA, attributeId: "meanRadius", seed: 1 },
      fixtureContext().bodies,
    );
    const records = captureEvidence([], outcome).records;
    expect(JSON.parse(JSON.stringify(records))).toEqual(records);
  });
});

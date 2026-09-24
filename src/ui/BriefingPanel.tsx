/**
 * The briefing surface.
 *
 * Text-first, semantic, and readable without the renderer — the 3D view is an
 * enhancement, never the route to required evidence (docs/ACCESSIBILITY.md §1).
 */

export interface BriefingPanelProps {
  readonly missionId: string | null;
}

export function BriefingPanel({ missionId }: BriefingPanelProps) {
  return (
    <section aria-labelledby="briefing-heading" data-testid="briefing-panel">
      <h2 id="briefing-heading">Briefing</h2>
      <p>
        You are a junior planetary scientist running a survey probe. Your job is not to
        recall facts about planets. Your job is to measure them, keep the evidence, compare
        worlds, and make a claim that the data can back up.
      </p>
      <p>
        Every mission follows the same loop: <strong>brief</strong>,{" "}
        <strong>choose a target</strong>, <strong>select an instrument</strong>,{" "}
        <strong>observe and measure</strong>, <strong>capture evidence</strong>,{" "}
        <strong>compare worlds</strong>, <strong>make a claim</strong>,{" "}
        <strong>cite your evidence</strong>, then <strong>read the debrief</strong> and
        revise or replay.
      </p>
      {missionId ? (
        <p>
          Current mission: <code>{missionId}</code>
        </p>
      ) : (
        <p data-testid="briefing-empty-state">
          No mission is loaded. Planetary Survey is in its foundation phase: the contract
          that fixes the science, the architecture, and the release gates is complete, and
          the canonical bodies and missions are authored in GAME-368 / PS-04 after
          source-based science review. This build deliberately ships no planetary values,
          because an unsourced number is worse than no number.
        </p>
      )}
    </section>
  );
}

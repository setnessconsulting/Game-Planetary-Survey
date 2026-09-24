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
          No mission is loaded. The canonical worlds and missions now exist and every
          displayed value is cited in the per-field source register, but they are still
          flagged unreviewed because no independent science review has happened yet, and
          this shell does not load them until a later build. So the survey is still waiting
          on its content rather than measuring with an unsourced number, because an
          unsourced number is worse than no number.
        </p>
      )}
    </section>
  );
}

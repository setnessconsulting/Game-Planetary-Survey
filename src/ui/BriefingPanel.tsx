/**
 * The briefing surface.
 *
 * Text-first, semantic, and readable without the renderer — the 3D view is an
 * enhancement, never the route to required evidence (docs/ACCESSIBILITY.md §1).
 */

import { findMission } from "@/content";

export interface BriefingPanelProps {
  readonly missionId: string | null;
  readonly scienceReviewed: boolean;
}

export function BriefingPanel({ missionId, scienceReviewed }: BriefingPanelProps) {
  const mission = missionId ? findMission(missionId) : undefined;

  return (
    <section aria-labelledby="briefing-heading" data-testid="briefing-panel">
      <h2 id="briefing-heading">Briefing</h2>
      {mission ? (
        <>
          <p data-testid="briefing-title">
            <strong>{mission.title}</strong>
          </p>
          <p data-testid="briefing-text">{mission.brief}</p>
          <p>
            Current mission: <code>{mission.id}</code>
            {!scienceReviewed
              ? " — values are sourced and still awaiting independent science review."
              : null}
          </p>
        </>
      ) : (
        <>
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
          <p data-testid="briefing-empty-state">
            No mission is loaded yet. Open a guided or independent survey from the workstation
            controls. Authored values are cited in the source register; independent science
            review is still outstanding, so they are shown as unreviewed rather than settled.
          </p>
        </>
      )}
    </section>
  );
}

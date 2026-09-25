/**
 * Debrief.
 *
 * docs/UX_USER_FLOW.md step 10: the debrief reports separate dimensions, never one
 * opaque correctness score, and every statement is traceable to something the
 * learner did or did not collect. The verdict is the first word on the surface; the
 * reasoning is beneath it. Nothing here is red-only or blame-shaped, and no fact is
 * asserted that the mission did not author — a `sourced` fact names the register
 * entries it came from.
 */

import { ATTRIBUTES, type AttributeId } from "@/domain/attributes";
import type { BodyRecord } from "@/domain/bodies";
import type { ClaimDimensions, ClaimVerdict } from "@/domain/claims";
import type { CompletionSummary, MissionDebrief } from "@/domain/debrief";
import type { EvidenceRecord } from "@/domain/evidence";
import { formatQuantity } from "@/domain/quantities";

import styles from "./Claim.module.css";

export interface DebriefProps {
  readonly debrief: MissionDebrief;
  readonly evidence: readonly EvidenceRecord[];
  readonly completion: CompletionSummary | null;
  readonly bodies: readonly BodyRecord[];
  readonly completeEnabled: boolean;
  readonly reviseEnabled: boolean;
  readonly onComplete: () => void;
  readonly onRevise: () => void;
}

function bodyLabel(bodies: readonly BodyRecord[], bodyId: string): string {
  return bodies.find((body) => body.id === bodyId)?.displayName ?? bodyId;
}

/**
 * Turn a mission observation key (`moon.meanRadius`) into learner-facing words.
 *
 * The mission's `requiredEvidence` is authored as keys because that is what the
 * catalogue can validate; a learner should never be shown `moon.meanRadius`.
 */
function observationLabel(bodies: readonly BodyRecord[], key: string): string {
  const [bodyId, attributeId] = key.split(".");
  if (!bodyId || !attributeId) return key;
  const label =
    attributeId in ATTRIBUTES ? ATTRIBUTES[attributeId as AttributeId].label : attributeId;
  return `${bodyLabel(bodies, bodyId)} — ${label}`;
}

function verdictWord(verdict: ClaimVerdict): string {
  switch (verdict) {
    case "supported":
      return "Supported";
    case "contradicted":
      return "Contradicted";
    case "insufficient-evidence":
      return "Insufficient evidence";
    default: {
      const unreachable: never = verdict;
      return unreachable;
    }
  }
}

function dimensionRows(dimensions: ClaimDimensions): readonly (readonly [string, string])[] {
  return [
    ["Citation coverage", dimensions.citationCoverage ? "Both worlds cited" : "Citation incomplete"],
    [
      "Evidence adequacy",
      dimensions.evidenceAdequacy ? "Evidence is about this property" : "Evidence is not about this property",
    ],
    [
      "Units and precision",
      dimensions.unitAndPrecisionCare ? "Carried with the readings" : "Missing or incomplete",
    ],
    [
      "Reasoning consistency",
      dimensions.reasoningConsistency
        ? "The relation follows the cited values"
        : "The relation does not follow the cited values",
    ],
  ];
}

export function Debrief({
  debrief,
  evidence,
  completion,
  bodies,
  completeEnabled,
  reviseEnabled,
  onComplete,
  onRevise,
}: DebriefProps) {
  const described = (id: string): string => {
    const record = evidence.find((candidate) => candidate.id === id);
    if (!record) return id;
    return `${bodyLabel(bodies, record.bodyId)} — ${ATTRIBUTES[record.attributeId].label}: ${formatQuantity(
      record.reading,
      record.significantDigits,
    )}`;
  };

  return (
    <section aria-labelledby="debrief-heading" data-testid="debrief">
      <h2 id="debrief-heading">Debrief</h2>

      <p data-testid="debrief-verdict">
        <strong className={styles.verdict}>{verdictWord(debrief.verdict)}.</strong>{" "}
        {debrief.explanation}
      </p>

      <dl className={styles.dimensions} data-testid="debrief-dimensions">
        {dimensionRows(debrief.dimensions).map(([label, value]) => (
          <div key={label} style={{ display: "contents" }}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>

      {debrief.citationProblems.length > 0 ? (
        <div className={styles.caution} data-testid="debrief-citation-problems">
          <p>What the citation is still missing:</p>
          <ul>
            {debrief.citationProblems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {debrief.missingRequiredEvidence.length > 0 ? (
        // A supported claim is not a met mission target (D-40): the mission's own
        // required evidence has to be cited too, and here is what is still missing.
        <div className={styles.caution} data-testid="debrief-missing-evidence">
          <p>Still needed for this mission's claim target:</p>
          <ul>
            {debrief.missingRequiredEvidence.map((key) => (
              <li key={key}>{observationLabel(bodies, key)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {debrief.comparedValues.length > 0 ? (
        <table data-testid="debrief-values">
          <caption className={styles.visuallyHidden}>
            The values this claim was checked against.
          </caption>
          <thead>
            <tr>
              <th scope="col">World</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {debrief.comparedValues.map((entry) => (
              <tr key={`${entry.bodyId}-${entry.attributeId}`}>
                <th scope="row">{bodyLabel(bodies, entry.bodyId)}</th>
                <td>{formatQuantity(entry.value, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {debrief.supportingEvidenceIds.length > 0 ? (
        <div data-testid="debrief-supporting">
          <h3>Observations that support the claim</h3>
          <ul>
            {debrief.supportingEvidenceIds.map((id) => (
              <li key={id}>{described(id)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {debrief.refutingEvidenceIds.length > 0 ? (
        <div data-testid="debrief-refuting">
          <h3>Observations that point the other way</h3>
          <ul>
            {debrief.refutingEvidenceIds.map((id) => (
              <li key={id}>{described(id)}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <h3>What this mission's evidence says</h3>
      <ul className={styles.facts} data-testid="debrief-facts">
        {debrief.facts.map((fact) => (
          <li key={fact.id} data-basis={fact.basis}>
            {fact.text}{" "}
            <span className={styles.factBasis}>
              ({fact.basis === "measured" ? "measured by you" : "from the source register"})
              {fact.sourceIds.length > 0 ? (
                <>
                  {": "}
                  {fact.sourceIds.map((sourceId) => (
                    <code key={sourceId}>{sourceId} </code>
                  ))}
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {debrief.misconception ? (
        <div className={styles.caution} data-testid="debrief-misconception">
          <p>
            <strong>A common reading:</strong> “{debrief.misconception.belief}”
          </p>
          <p>{debrief.misconception.feedback}</p>
        </div>
      ) : null}

      {completion ? (
        <div data-testid="debrief-completion">
          <h3>Mission summary</h3>
          <dl className={styles.dimensions}>
            <div style={{ display: "contents" }}>
              <dt>Claim target</dt>
              <dd data-testid="debrief-target-status">
                {completion.targetMet
                  ? "Met by the cited evidence"
                  : debrief.verdict === "supported"
                    ? "Supported, but not met — the mission asks for evidence this claim does not cite"
                    : "Not yet supported"}
              </dd>
            </div>
            <div style={{ display: "contents" }}>
              <dt>Observations kept</dt>
              <dd>
                {completion.observationsCaptured} of {completion.observationsRequired} the mission
                requires, {completion.evidenceCount} in the notebook
              </dd>
            </div>
            <div style={{ display: "contents" }}>
              <dt>Citations and attempts</dt>
              <dd>
                {completion.citationCount} cited · {completion.claimAttempts} submission
                {completion.claimAttempts === 1 ? "" : "s"} · {completion.hintsUsed} hint
                {completion.hintsUsed === 1 ? "" : "s"}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className={styles.actions}>
        <button
          type="button"
          data-testid="complete-mission"
          disabled={!completeEnabled}
          onClick={onComplete}
        >
          Complete mission
        </button>
        <button
          type="button"
          data-testid="revise-claim"
          disabled={!reviseEnabled}
          onClick={onRevise}
        >
          Revise claim — keep everything measured
        </button>
      </div>
    </section>
  );
}

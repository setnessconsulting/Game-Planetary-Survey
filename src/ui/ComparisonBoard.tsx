/**
 * Comparison board: side-by-side readings from the notebook.
 *
 * The table is the authoritative comparison (docs/ACCESSIBILITY.md A-13). Any
 * chart twin is a second view of the same rows and must never invent scale.
 * Comparison is requested by a control — never inferred from the 3D view.
 */

import { ATTRIBUTES } from "@/domain/attributes";
import type { BodyRecord } from "@/domain/bodies";
import {
  MINIMUM_COMPARISON_BODIES,
  comparableAttributes,
  compareByAttribute,
  proportionalReading,
  type ComparativeFinding,
} from "@/domain/comparison";
import type { EvidenceRecord } from "@/domain/evidence";
import { formatQuantity } from "@/domain/quantities";

import styles from "./ComparisonBoard.module.css";

export interface ComparisonBoardProps {
  readonly evidence: readonly EvidenceRecord[];
  readonly findings: readonly ComparativeFinding[];
  readonly bodies: readonly BodyRecord[];
  readonly compareEnabled: boolean;
  readonly onCompare: () => void;
}

function bodyLabel(bodies: readonly BodyRecord[], bodyId: string): string {
  return bodies.find((body) => body.id === bodyId)?.displayName ?? bodyId;
}

function findingStatement(
  finding: ComparativeFinding,
  bodies: readonly BodyRecord[],
): string {
  const label = ATTRIBUTES[finding.attributeId].label.toLowerCase();
  const ranked = finding.ordering.map((id) => bodyLabel(bodies, id));
  const ratioText =
    finding.ratio === null
      ? ""
      : ` The largest is about ${finding.ratio.toPrecision(3)} times the smallest.`;
  return `By ${label}, largest to smallest: ${ranked.join(", ")}.${ratioText}`;
}

function insufficientPreview(evidence: readonly EvidenceRecord[]): string | null {
  if (evidence.length === 0) {
    return `Capture measurements from at least ${MINIMUM_COMPARISON_BODIES} worlds before comparing.`;
  }
  if (comparableAttributes(evidence).length > 0) {
    return null;
  }
  const attributeIds = [...new Set(evidence.map((record) => record.attributeId))];
  for (const attributeId of attributeIds) {
    const result = compareByAttribute(evidence, attributeId);
    if (result.kind === "insufficient") {
      return result.explanation;
    }
  }
  return `Comparing needs at least ${MINIMUM_COMPARISON_BODIES} worlds that share the same property in the notebook.`;
}

export function ComparisonBoard({
  evidence,
  findings,
  bodies,
  compareEnabled,
  onCompare,
}: ComparisonBoardProps) {
  const readyAttributes = comparableAttributes(evidence);
  const canCompare = compareEnabled && readyAttributes.length > 0;
  const insufficient = insufficientPreview(evidence);
  const hasFindings = findings.length > 0;

  return (
    <section aria-labelledby="comparison-heading" data-testid="comparison-board">
      <h2 id="comparison-heading">Compare worlds</h2>
      <p className={styles.lede}>
        Put two or more captured readings side by side on the same property. The
        table is the measurement; any bars below are a non-literal twin of those
        rows, not a picture of real scale.
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          data-testid="compare-button"
          disabled={!canCompare}
          onClick={onCompare}
        >
          Compare worlds
        </button>
      </div>

      {!hasFindings && insufficient ? (
        <p data-testid="comparison-insufficient" className={styles.insufficient}>
          {insufficient}
        </p>
      ) : null}

      {!hasFindings && !insufficient ? (
        <p data-testid="comparison-ready" className={styles.ready}>
          Enough evidence is in the notebook. Compare worlds to rank the readings.
        </p>
      ) : null}

      {findings.map((finding) => {
        const attribute = ATTRIBUTES[finding.attributeId];
        const orderedEntries = finding.ordering.map(
          (bodyId) => finding.entries.find((entry) => entry.bodyId === bodyId)!,
        );
        const maxValue = Math.max(...orderedEntries.map((entry) => entry.value.value), 0);

        return (
          <div
            key={finding.attributeId}
            className={styles.finding}
            data-testid={`comparison-finding-${finding.attributeId}`}
            data-proportional={finding.proportional ? "true" : "false"}
          >
            <p className={styles.statement} data-testid={`comparison-statement-${finding.attributeId}`}>
              {findingStatement(finding, bodies)}
            </p>

            <table className={styles.table} data-testid={`comparison-table-${finding.attributeId}`}>
              <caption>
                {attribute.label} compared across {orderedEntries.length} worlds (canonical unit:{" "}
                {finding.unit})
              </caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">World</th>
                  <th scope="col">Reading</th>
                  {finding.proportional ? <th scope="col">Share of largest</th> : null}
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {orderedEntries.map((entry, index) => {
                  const share = finding.proportional
                    ? proportionalReading(finding, entry.bodyId)
                    : null;
                  return (
                    <tr key={entry.evidenceId}>
                      <td>{index + 1}</td>
                      <th scope="row">{bodyLabel(bodies, entry.bodyId)}</th>
                      <td>{formatQuantity(entry.value, entry.significantDigits)}</td>
                      {finding.proportional ? (
                        <td data-testid={`comparison-share-${finding.attributeId}-${entry.bodyId}`}>
                          {share === null
                            ? "—"
                            : `${(share * 100).toPrecision(3)}% of the largest value in this comparison (attribute is interpreted relative to body size)`}
                        </td>
                      ) : null}
                      <td>
                        <code>{entry.sourceId}</code>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div
              className={styles.chart}
              data-testid={`comparison-chart-${finding.attributeId}`}
              aria-hidden="true"
            >
              <p className={styles.chartNote}>
                Non-literal chart twin of the table above — bar length is relative
                within this comparison only, not true planetary scale.
              </p>
              <ul className={styles.bars}>
                {orderedEntries.map((entry) => {
                  const widthPercent =
                    maxValue <= 0 ? 0 : (entry.value.value / maxValue) * 100;
                  return (
                    <li key={entry.evidenceId}>
                      <span className={styles.barLabel}>
                        {bodyLabel(bodies, entry.bodyId)}
                      </span>
                      <span className={styles.barTrack}>
                        <span
                          className={styles.barFill}
                          style={{ width: `${widthPercent}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </section>
  );
}

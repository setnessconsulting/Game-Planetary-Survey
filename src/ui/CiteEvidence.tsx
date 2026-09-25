/**
 * Cite evidence.
 *
 * docs/UX_USER_FLOW.md step 9 and the `cite-evidence` surface: the learner binds
 * their claim to specific notebook records. Checkboxes are individually focusable,
 * each row is a full-width label at the touch minimum, and nothing is pre-selected
 * for the learner — the records are offered in notebook order and the citation is
 * their choice.
 *
 * An uncited claim **can** be submitted on purpose. The domain then refuses to
 * count it (`insufficient-evidence`) and explains why, which is the anti-guessing
 * rule taught in-product rather than enforced by a disabled button.
 */

import { ATTRIBUTES } from "@/domain/attributes";
import type { BodyRecord } from "@/domain/bodies";
import type { Claim } from "@/domain/claims";
import type { EvidenceRecord } from "@/domain/evidence";
import { formatQuantity } from "@/domain/quantities";

import styles from "./Claim.module.css";

export interface CiteEvidenceProps {
  readonly claim: Claim | null;
  readonly evidence: readonly EvidenceRecord[];
  readonly bodies: readonly BodyRecord[];
  readonly enabled: boolean;
  readonly onCite: (evidenceIds: readonly string[]) => void;
  readonly onSubmit: () => void;
}

function bodyLabel(bodies: readonly BodyRecord[], bodyId: string): string {
  return bodies.find((body) => body.id === bodyId)?.displayName ?? bodyId;
}

export function CiteEvidence({
  claim,
  evidence,
  bodies,
  enabled,
  onCite,
  onSubmit,
}: CiteEvidenceProps) {
  const cited = claim?.citedEvidenceIds ?? [];
  const ready = enabled && claim !== null;

  return (
    <section aria-labelledby="cite-heading" data-testid="cite-evidence">
      <h2 id="cite-heading">Cite evidence</h2>
      <p className={styles.lede}>
        Attach the notebook observations that support your claim. A claim counts when the
        evidence behind it is cited — being right is not the same as being supported.
      </p>

      {!claim ? (
        <p data-testid="cite-no-claim">Draft a claim before citing evidence for it.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) onSubmit();
          }}
        >
          <p className={styles.count} data-testid="cite-count" aria-live="polite">
            Cited {cited.length} of {evidence.length} observation
            {evidence.length === 1 ? "" : "s"}.
          </p>

          <fieldset className={styles.citations} disabled={!enabled}>
            <legend>Observations in your notebook</legend>
            {evidence.length === 0 ? (
              <p data-testid="cite-empty-notebook">
                The notebook is empty. Measure a world and capture the observation first.
              </p>
            ) : (
              evidence.map((record) => {
                const checked = cited.includes(record.id);
                return (
                  <div className={styles.citationRow} key={record.id}>
                    <label>
                      <input
                        type="checkbox"
                        data-testid={`cite-record-${record.id}`}
                        checked={checked}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...cited, record.id]
                            : cited.filter((id) => id !== record.id);
                          onCite(next);
                        }}
                      />
                      <span>
                        {bodyLabel(bodies, record.bodyId)} — {ATTRIBUTES[record.attributeId].label}:{" "}
                        {formatQuantity(record.reading, record.significantDigits)}
                        <br />
                        <span className={styles.citationMeta}>
                          Source <code>{record.sourceId}</code>
                        </span>
                      </span>
                    </label>
                  </div>
                );
              })
            )}
          </fieldset>

          <div className={styles.actions}>
            <button type="submit" data-testid="submit-claim" disabled={!ready}>
              Submit claim with cited observations
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

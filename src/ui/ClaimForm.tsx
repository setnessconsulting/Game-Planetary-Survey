/**
 * Make a claim.
 *
 * docs/UX_USER_FLOW.md step 8 and the `claim` surface in `src/design/surfaces.ts`:
 * the claim is composed from named parts — property, basis, relation, first world,
 * second world — so it can be checked rather than appraised. It is a real form with
 * labelled selects, never a drag or a canvas, and the draft sentence is rendered as
 * text as the parts change (A-11).
 *
 * The form never offers a property that has no comparable pair in the notebook, so
 * "nothing to cite yet" is a stated state rather than a submit that silently fails.
 * Citations are added on the next step (`CiteEvidence`); a claim is drafted with an
 * empty citation on purpose, because deciding what to cite is the learner's job.
 */

import { useEffect, useMemo, useState } from "react";

import { ATTRIBUTES, type AttributeId } from "@/domain/attributes";
import type { BodyRecord } from "@/domain/bodies";
import type { MissionDefinition } from "@/domain/catalog";
import {
  describeClaimRelation,
  type Claim,
  type ClaimBasis,
  type ClaimDraft,
  type ClaimRelation,
} from "@/domain/claims";
import type { ComparativeFinding } from "@/domain/comparison";

import styles from "./Claim.module.css";

export interface ClaimFormProps {
  readonly mission: MissionDefinition | null;
  /** Findings from the notebook; each one is a property with a comparable pair. */
  readonly comparableFindings: readonly ComparativeFinding[];
  readonly bodies: readonly BodyRecord[];
  readonly claim: Claim | null;
  readonly enabled: boolean;
  readonly onDraft: (draft: ClaimDraft) => void;
}

const RELATIONS: readonly ClaimRelation[] = ["largerThan", "smallerThan", "sameAs"];

function bodyLabel(bodies: readonly BodyRecord[], bodyId: string): string {
  return bodies.find((body) => body.id === bodyId)?.displayName ?? bodyId;
}

export function ClaimForm({
  mission,
  comparableFindings,
  bodies,
  claim,
  enabled,
  onDraft,
}: ClaimFormProps) {
  // Memoised so the reconciliation effect below does not re-run on every render: a
  // fresh array identity each render would defeat its dependency check.
  const attributes = useMemo(
    () => comparableFindings.map((finding) => finding.attributeId),
    [comparableFindings],
  );
  const target = mission?.claimTarget ?? null;
  const defaultAttribute =
    target && attributes.includes(target.attributeId) ? target.attributeId : attributes[0];

  const [attributeId, setAttributeId] = useState<AttributeId | undefined>(defaultAttribute);
  const [basis, setBasis] = useState<ClaimBasis>(target?.basis ?? "magnitude");
  const [relation, setRelation] = useState<ClaimRelation>(target?.relation ?? "largerThan");
  const [subject, setSubject] = useState<string | undefined>(
    target && attributes.includes(target.attributeId) ? target.subject : undefined,
  );
  const [object, setObject] = useState<string | undefined>(
    target && attributes.includes(target.attributeId) ? target.object : undefined,
  );

  const finding = comparableFindings.find((entry) => entry.attributeId === attributeId);
  const availableBodies = finding ? finding.entries.map((entry) => entry.bodyId) : [];

  // Keep every select on a value that the current evidence can actually check. When
  // the notebook changes under the form (another world captured), a now-invalid
  // choice falls back to a defensible default instead of rendering an empty select.
  useEffect(() => {
    if (!attributeId || !attributes.includes(attributeId)) {
      setAttributeId(defaultAttribute);
      if (target && defaultAttribute === target.attributeId) {
        setBasis(target.basis);
        setRelation(target.relation);
        setSubject(target.subject);
        setObject(target.object);
      } else {
        setSubject(undefined);
        setObject(undefined);
      }
      return;
    }
    const ids = comparableFindings.find((entry) => entry.attributeId === attributeId)
      ?.entries.map((entry) => entry.bodyId) ?? [];
    if (!subject || !ids.includes(subject)) setSubject(ids[0]);
    if (!object || !ids.includes(object) || object === subject) {
      setObject(ids.find((id) => id !== subject) ?? ids[1]);
    }
  }, [attributes, attributeId, comparableFindings, defaultAttribute, object, subject, target]);

  const ready =
    enabled &&
    attributeId !== undefined &&
    subject !== undefined &&
    object !== undefined &&
    subject !== object;

  const draft: ClaimDraft | null =
    ready && attributeId && subject && object
      ? { attributeId, basis, subject, relation, object, citedEvidenceIds: [] }
      : null;

  const sentence = draft
    ? `${bodyLabel(bodies, draft.subject)} ${describeClaimRelation(draft.relation)} ${bodyLabel(
        bodies,
        draft.object,
      )} by ${ATTRIBUTES[draft.attributeId].label.toLowerCase()}${
        draft.basis === "proportionOfRadius"
          ? ", as a proportion of each world's own mean radius"
          : ""
      }.`
    : null;

  return (
    <section aria-labelledby="claim-heading" data-testid="claim-form">
      <h2 id="claim-heading">Make a claim</h2>
      <p className={styles.lede}>
        State a relation between two worlds on the same property. The claim is built from
        named parts, so it can be checked against the evidence you cite on the next step.
      </p>

      {attributes.length === 0 ? (
        <p data-testid="claim-uncitable" className={styles.caution}>
          Nothing to claim yet. A claim needs the same property captured for two worlds, so
          compare at least two worlds first.
        </p>
      ) : (
        <>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              if (draft) onDraft(draft);
            }}
          >
            <div className={styles.control}>
              <label htmlFor="claim-attribute">Property</label>
              <select
                id="claim-attribute"
                data-testid="claim-attribute"
                value={attributeId ?? ""}
                disabled={!enabled}
                onChange={(event) => setAttributeId(event.target.value as AttributeId)}
              >
                {attributes.map((id) => (
                  <option key={id} value={id}>
                    {ATTRIBUTES[id].label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.control}>
              <label htmlFor="claim-basis">Comparison basis</label>
              <select
                id="claim-basis"
                data-testid="claim-basis"
                value={basis}
                disabled={!enabled || ATTRIBUTES[attributeId ?? "meanRadius"].kind !== "length"}
                onChange={(event) => setBasis(event.target.value as ClaimBasis)}
              >
                <option value="magnitude">Absolute values</option>
                <option value="proportionOfRadius">Proportion of each world's radius</option>
              </select>
            </div>

            <div className={styles.control}>
              <label htmlFor="claim-relation">Relation</label>
              <select
                id="claim-relation"
                data-testid="claim-relation"
                value={relation}
                disabled={!enabled}
                onChange={(event) => setRelation(event.target.value as ClaimRelation)}
              >
                {RELATIONS.map((value) => (
                  <option key={value} value={value}>
                    {describeClaimRelation(value)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.control}>
              <label htmlFor="claim-subject">First world</label>
              <select
                id="claim-subject"
                data-testid="claim-subject"
                value={subject ?? ""}
                disabled={!enabled}
                onChange={(event) => setSubject(event.target.value)}
              >
                {availableBodies.map((id) => (
                  <option key={id} value={id}>
                    {bodyLabel(bodies, id)}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.control}>
              <label htmlFor="claim-object">Second world</label>
              <select
                id="claim-object"
                data-testid="claim-object"
                value={object ?? ""}
                disabled={!enabled}
                onChange={(event) => setObject(event.target.value)}
              >
                {availableBodies
                  .filter((id) => id !== subject)
                  .map((id) => (
                    <option key={id} value={id}>
                      {bodyLabel(bodies, id)}
                    </option>
                  ))}
              </select>
            </div>

            <button type="submit" data-testid="draft-claim" disabled={!ready}>
              Draft claim
            </button>
          </form>

          <p className={styles.draft} data-testid="claim-draft-sentence">
            {sentence ?? "Choose two worlds on the same property to compose a claim."}
          </p>
        </>
      )}

      {claim ? (
        <p data-testid="claim-current">
          Drafted claim: {bodyLabel(bodies, claim.subject)}{" "}
          {describeClaimRelation(claim.relation)} {bodyLabel(bodies, claim.object)}.
        </p>
      ) : null}
    </section>
  );
}

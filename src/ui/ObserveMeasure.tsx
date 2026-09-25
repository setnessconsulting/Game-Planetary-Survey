/**
 * Observe / measure and evidence capture controls.
 *
 * Attribute choice is scoped to what the selected instrument can measure.
 * Readings show value, unit, significant figures, source, and review status.
 * Capture is an explicit learner choice; the live region carries announcements
 * from the mission seam.
 */

import { useEffect, useState } from "react";

import { ATTRIBUTES, type AttributeId } from "@/domain/attributes";
import type { MeasurementOutcome } from "@/domain/measurement";
import { formatQuantity } from "@/domain/quantities";

import styles from "./ObserveMeasure.module.css";

export interface ObserveMeasureProps {
  readonly attributeIds: readonly AttributeId[];
  readonly lastMeasurement: MeasurementOutcome | null;
  readonly measureEnabled: boolean;
  readonly captureEnabled: boolean;
  readonly onMeasure: (attributeId: AttributeId) => void;
  readonly onCapture: () => void;
}

function reviewLabel(status: "unreviewed" | "reviewed" | "contested"): string {
  switch (status) {
    case "unreviewed":
      return "Science review outstanding (unreviewed)";
    case "reviewed":
      return "Independently reviewed";
    case "contested":
      return "Contested between published sources";
  }
}

export function ObserveMeasure({
  attributeIds,
  lastMeasurement,
  measureEnabled,
  captureEnabled,
  onMeasure,
  onCapture,
}: ObserveMeasureProps) {
  const [attributeId, setAttributeId] = useState<AttributeId | null>(
    attributeIds[0] ?? null,
  );

  useEffect(() => {
    if (attributeIds.length === 0) {
      setAttributeId(null);
      return;
    }
    if (attributeId === null || !attributeIds.includes(attributeId)) {
      setAttributeId(attributeIds[0]!);
    }
  }, [attributeIds, attributeId]);

  const canMeasure = measureEnabled && attributeId !== null && attributeIds.length > 0;

  return (
    <section aria-labelledby="observe-heading" data-testid="observe-measure">
      <h2 id="observe-heading">Observe and measure</h2>
      <p className={styles.lede}>
        Run the selected instrument. The reading is text — value, unit, precision, and
        source — not a picture of the world.
      </p>

      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          if (canMeasure && attributeId !== null) {
            onMeasure(attributeId);
          }
        }}
      >
        <div className={styles.control}>
          <label htmlFor="measure-attribute">Property to measure</label>
          <select
            id="measure-attribute"
            data-testid="measure-attribute"
            value={attributeId ?? ""}
            disabled={!measureEnabled || attributeIds.length === 0}
            onChange={(event) => setAttributeId(event.target.value as AttributeId)}
          >
            {attributeIds.length === 0 ? (
              <option value="">Select a target and instrument first</option>
            ) : (
              attributeIds.map((id) => (
                <option key={id} value={id}>
                  {ATTRIBUTES[id].label}
                </option>
              ))
            )}
          </select>
        </div>

        <button
          type="submit"
          data-testid="measure-button"
          disabled={!canMeasure}
        >
          Measure
        </button>
      </form>

      <div className={styles.reading} data-testid="last-measurement">
        {!lastMeasurement ? (
          <p data-testid="measurement-idle">No measurement yet.</p>
        ) : lastMeasurement.kind === "unavailable" ? (
          <div data-testid="measurement-unavailable">
            <p>
              <strong>No authoritative value.</strong> {lastMeasurement.explanation}
            </p>
          </div>
        ) : (
          <dl data-testid="measurement-result">
            <dt>Reading</dt>
            <dd>
              {formatQuantity(lastMeasurement.reading, lastMeasurement.significantDigits)}
            </dd>
            <dt>Source</dt>
            <dd>
              <code>{lastMeasurement.sourceId}</code>
            </dd>
            <dt>Significant figures</dt>
            <dd>{lastMeasurement.significantDigits}</dd>
            <dt>Review status</dt>
            <dd data-testid="measurement-review-status">
              {reviewLabel(lastMeasurement.reviewStatus)}
            </dd>
          </dl>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          data-testid="capture-evidence"
          disabled={!captureEnabled}
          onClick={onCapture}
        >
          Capture evidence
        </button>
      </div>
    </section>
  );
}

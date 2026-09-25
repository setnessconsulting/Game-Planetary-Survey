/**
 * Target selection surface: choose a survey world from a real table.
 *
 * The 3D view may illustrate the system; this table is the authoritative route
 * to the same action (docs/ACCESSIBILITY.md A-14, surfaces.ts target-selection).
 */

import type { BodyRecord } from "@/domain/bodies";
import { bodyPropertyAvailability } from "@/domain/measurement";

import styles from "./TargetSelection.module.css";

export interface TargetSelectionProps {
  readonly bodies: readonly BodyRecord[];
  readonly selectedBodyId: string | null;
  readonly enabled: boolean;
  readonly onSelect: (bodyId: string) => void;
}

export function TargetSelection({
  bodies,
  selectedBodyId,
  enabled,
  onSelect,
}: TargetSelectionProps) {
  const selected = bodies.find((body) => body.id === selectedBodyId) ?? null;
  const properties = selected ? bodyPropertyAvailability(selected) : [];

  return (
    <section aria-labelledby="target-heading" data-testid="target-selection">
      <h2 id="target-heading">Choose a target</h2>
      <p className={styles.lede}>
        Pick a world from the catalogue. The survey view may show a compressed
        comparison; the table is how you choose, and the notebook is where
        measurements live.
      </p>
      <table className={styles.table} data-testid="target-table">
        <caption className="ps-visually-hidden">
          Survey catalogue worlds available for this mission
        </caption>
        <thead>
          <tr>
            <th scope="col">World</th>
            <th scope="col">Summary</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {bodies.map((body) => {
            const isSelected = body.id === selectedBodyId;
            return (
              <tr key={body.id} data-selected={isSelected ? "true" : "false"}>
                <th scope="row">{body.displayName}</th>
                <td>{body.summary}</td>
                <td>
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-pressed={isSelected}
                    data-testid={`select-target-${body.id}`}
                    onClick={() => onSelect(body.id)}
                  >
                    {isSelected ? "Selected" : "Survey this world"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className={styles.properties} data-testid="target-properties">
        <h3 className={styles.propertiesHeading}>Sourced properties</h3>
        {!selected ? (
          <p data-testid="target-properties-idle">
            Select a world to see which properties have a published value in the
            source register.
          </p>
        ) : (
          <table className={styles.table} data-testid="target-properties-table">
            <caption className="ps-visually-hidden">
              Sourced property availability for {selected.displayName}
            </caption>
            <thead>
              <tr>
                <th scope="col">Property</th>
                <th scope="col">Availability</th>
                <th scope="col">Review</th>
              </tr>
            </thead>
            <tbody>
              {properties.map((row) => (
                <tr key={row.attributeId} data-available={row.available ? "true" : "false"}>
                  <th scope="row">{row.label}</th>
                  <td>
                    {row.available
                      ? `Published value available${row.unit ? ` (${row.unit})` : ""}`
                      : "No published value in the register"}
                  </td>
                  <td>
                    {row.reviewStatus === null
                      ? "—"
                      : row.reviewStatus === "unreviewed"
                        ? "Unreviewed"
                        : row.reviewStatus === "contested"
                          ? "Contested"
                          : "Reviewed"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

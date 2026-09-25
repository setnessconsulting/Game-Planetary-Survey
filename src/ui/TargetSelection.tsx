/**
 * Target selection surface: choose a survey world from a real table.
 *
 * The 3D view may illustrate the system; this table is the authoritative route
 * to the same action (docs/ACCESSIBILITY.md A-14, surfaces.ts target-selection).
 */

import type { BodyRecord } from "@/domain/bodies";

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
            const selected = body.id === selectedBodyId;
            return (
              <tr key={body.id} data-selected={selected ? "true" : "false"}>
                <th scope="row">{body.displayName}</th>
                <td>{body.summary}</td>
                <td>
                  <button
                    type="button"
                    disabled={!enabled}
                    aria-pressed={selected}
                    data-testid={`select-target-${body.id}`}
                    onClick={() => onSelect(body.id)}
                  >
                    {selected ? "Selected" : "Survey this world"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

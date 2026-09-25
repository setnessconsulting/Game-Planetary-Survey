/**
 * Instrument selection surface: choose which probe instrument to run.
 *
 * Offers only instruments justified by the active mission's required observations
 * for the selected body (plus domain availability), never an arbitrary full list.
 */

import type { InstrumentDefinition, InstrumentId } from "@/domain/measurement";

import styles from "./InstrumentSelection.module.css";

export interface InstrumentSelectionProps {
  readonly instruments: readonly InstrumentDefinition[];
  readonly selectedInstrumentId: InstrumentId | null;
  readonly enabled: boolean;
  readonly onSelect: (instrumentId: InstrumentId) => void;
}

export function InstrumentSelection({
  instruments,
  selectedInstrumentId,
  enabled,
  onSelect,
}: InstrumentSelectionProps) {
  return (
    <section aria-labelledby="instrument-heading" data-testid="instrument-selection">
      <h2 id="instrument-heading">Choose an instrument</h2>
      <p className={styles.lede}>
        Each instrument states what it measures, what it costs, and what it cannot
        answer. Pick the one that matches the survey question for this world.
      </p>

      {instruments.length === 0 ? (
        <p data-testid="instrument-empty-state">
          Select a target world first. Instruments appear once the mission asks for
          observations on that world.
        </p>
      ) : (
        <ul className={styles.list} role="list">
          {instruments.map((instrument) => {
            const selected = instrument.id === selectedInstrumentId;
            return (
              <li key={instrument.id} data-selected={selected ? "true" : "false"}>
                <button
                  type="button"
                  className={styles.option}
                  disabled={!enabled}
                  aria-pressed={selected}
                  data-testid={`select-instrument-${instrument.id}`}
                  onClick={() => onSelect(instrument.id)}
                >
                  <span className={styles.label}>
                    {selected ? "Selected · " : ""}
                    {instrument.label}
                  </span>
                  <span className={styles.purpose}>{instrument.purpose}</span>
                  <span className={styles.meta}>
                    Cost: {instrument.costTicks} tick{instrument.costTicks === 1 ? "" : "s"}.{" "}
                    Limitation: {instrument.limitation}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

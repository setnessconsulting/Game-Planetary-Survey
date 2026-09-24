/**
 * The evidence notebook.
 *
 * A REAL semantic table, not a canvas, not a chart. This is the accessible
 * equivalent that every measurement must have (docs/ACCESSIBILITY.md A-5,
 * A-13). The comparison board renders the same values from the same domain
 * function, so the chart and the table can never disagree.
 */

import { ATTRIBUTES } from "@/domain/attributes";
import type { EvidenceRecord } from "@/domain/evidence";
import { formatQuantity } from "@/domain/quantities";

export interface EvidenceNotebookProps {
  readonly records: readonly EvidenceRecord[];
}

export function EvidenceNotebook({ records }: EvidenceNotebookProps) {
  return (
    <section aria-labelledby="notebook-heading" data-testid="evidence-notebook">
      <h2 id="notebook-heading">Evidence notebook</h2>
      <p>
        Observations you have kept. Showing an observation is not the same as keeping it:
        a claim can only cite evidence that is in this notebook.
      </p>

      {records.length === 0 ? (
        <p data-testid="notebook-empty-state">
          The notebook is empty. Measure a world, then capture the observation here — and
          each entry will record which instrument produced it and which source the value
          came from.
        </p>
      ) : null}

      <table data-testid="notebook-table">
        <caption className="ps-visually-hidden">
          Captured observations, one row per measurement, with the source each value came
          from.
        </caption>
        <thead>
          <tr>
            <th scope="col">Body</th>
            <th scope="col">Property</th>
            <th scope="col">Instrument</th>
            <th scope="col">Reading</th>
            <th scope="col">Source</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={5}>No observations captured yet.</td>
            </tr>
          ) : (
            records.map((record) => (
              <tr key={record.id}>
                <td>{record.bodyId}</td>
                <td>{ATTRIBUTES[record.attributeId].label}</td>
                <td>{record.instrumentId}</td>
                <td>{formatQuantity(record.reading, record.significantDigits)}</td>
                <td>
                  <code>{record.sourceId}</code>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}

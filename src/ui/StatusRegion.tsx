/**
 * A polite live region.
 *
 * State changes that are otherwise visual must be announced. This exists so the
 * shell never relies on a learner noticing a canvas change
 * (docs/ACCESSIBILITY.md A-5).
 */

export interface StatusRegionProps {
  /** The single most recent announcement. Re-announced only when it changes. */
  readonly message: string;
  readonly tone?: "info" | "caution";
}

export function StatusRegion({ message, tone = "info" }: StatusRegionProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-tone={tone}
      className="ps-status-region"
    >
      {message}
    </p>
  );
}

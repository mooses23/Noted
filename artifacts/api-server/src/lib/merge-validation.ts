export type MergeValidationCommit = { id: string; roundId: string };
export type MergeValidationRound = {
  id: string;
  title: string;
  mergeBehavior: "single" | "multi";
};

/**
 * Validates that merging `commits` into a new version respects each round's
 * mergeBehavior. Returns null on success, or an error message on failure.
 *
 *  - `single` rounds (e.g. structure phase) accept exactly one merged commit.
 *  - `multi`  rounds (e.g. accent phase) accept any number of merged commits.
 */
export function validateMergeBehavior(
  commits: MergeValidationCommit[],
  rounds: MergeValidationRound[],
): string | null {
  const roundById = new Map(rounds.map((r) => [r.id, r]));
  const counts = new Map<string, number>();
  for (const c of commits) {
    counts.set(c.roundId, (counts.get(c.roundId) ?? 0) + 1);
  }
  for (const [rid, count] of counts) {
    const round = roundById.get(rid);
    if (!round) {
      return `Round ${rid} not found for merge validation.`;
    }
    if (round.mergeBehavior === "single" && count > 1) {
      return `Round "${round.title}" is single-merge (one winner) but ${count} commits were selected. Pick exactly one.`;
    }
  }
  return null;
}

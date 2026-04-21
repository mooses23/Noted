/**
 * Lightweight runnable test for the version merge-behavior rule.
 * Run with:
 *   node --experimental-strip-types --no-warnings \
 *     artifacts/api-server/src/lib/merge-validation.test.ts
 */
import { validateMergeBehavior } from "./merge-validation.ts";

let failed = 0;
function check(name: string, ok: boolean, details?: string) {
  if (ok) {
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}${details ? ` — ${details}` : ""}`);
  }
}

console.log("validateMergeBehavior");

const singleRound = { id: "r-single", title: "R1 Drums", mergeBehavior: "single" as const };
const multiRound  = { id: "r-multi",  title: "R3 Accents", mergeBehavior: "multi"  as const };

// 1. Single-merge round, exactly one commit -> OK
check(
  "single round + 1 commit -> OK",
  validateMergeBehavior(
    [{ id: "c1", roundId: "r-single" }],
    [singleRound],
  ) === null,
);

// 2. Single-merge round, two commits -> rejected with clear message
{
  const err = validateMergeBehavior(
    [
      { id: "c1", roundId: "r-single" },
      { id: "c2", roundId: "r-single" },
    ],
    [singleRound],
  );
  check(
    "single round + 2 commits -> rejected",
    err !== null && err.includes("single-merge"),
    err ?? "expected error",
  );
}

// 3. Multi-merge round, three commits -> OK
check(
  "multi round + 3 commits -> OK",
  validateMergeBehavior(
    [
      { id: "c1", roundId: "r-multi" },
      { id: "c2", roundId: "r-multi" },
      { id: "c3", roundId: "r-multi" },
    ],
    [multiRound],
  ) === null,
);

// 4. Mixed: single-round=1, multi-round=2 -> OK
check(
  "mixed valid (single x1 + multi x2) -> OK",
  validateMergeBehavior(
    [
      { id: "c1", roundId: "r-single" },
      { id: "c2", roundId: "r-multi" },
      { id: "c3", roundId: "r-multi" },
    ],
    [singleRound, multiRound],
  ) === null,
);

// 5. Mixed: single-round=2, multi-round=1 -> rejected
{
  const err = validateMergeBehavior(
    [
      { id: "c1", roundId: "r-single" },
      { id: "c2", roundId: "r-single" },
      { id: "c3", roundId: "r-multi" },
    ],
    [singleRound, multiRound],
  );
  check(
    "mixed invalid (single x2) -> rejected",
    err !== null && err.includes("single-merge"),
    err ?? "expected error",
  );
}

// 6. Unknown round -> rejected
{
  const err = validateMergeBehavior(
    [{ id: "c1", roundId: "r-unknown" }],
    [singleRound],
  );
  check(
    "unknown round -> rejected",
    err !== null && err.includes("not found"),
    err ?? "expected error",
  );
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log("\nAll merge-validation tests passed.");
}

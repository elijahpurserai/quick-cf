/**
 * Result constructors for tests that could not execute.
 *
 * Why this exists: several blocks in the suite depend on a fixture discovered at
 * runtime (a story slug scraped from the sitemap, a tag with content in the DB).
 * Those blocks used to collapse into a SINGLE result when the fixture was absent,
 * so the total test count moved from run to run and there was no way to tell which
 * tests had silently not run. Every block now emits one result per test name in
 * every case, so the count is stable and the tests page shows exactly what happened.
 *
 * The distinction that matters:
 *   - fixture legitimately absent (empty DB)     → SKIPPED, not a failure
 *   - the request that discovers it broke        → FAILED; something is actually wrong
 */

import { TestResult } from "./types";

/** Tests that had nothing to run against. Not a failure. */
export function skippedResults(names: readonly string[], reason: string): TestResult[] {
    return names.map(name => ({
        name,
        passed: false,
        skipped: true,
        message: `Skipped — ${reason}`,
        durationMs: 0,
    }));
}

/** Tests that could not run because a prerequisite request failed. This IS a failure. */
export function failedResults(names: readonly string[], reason: string): TestResult[] {
    return names.map(name => ({
        name,
        passed: false,
        message: `Did not run — ${reason}`,
        durationMs: 0,
    }));
}

/**
 * One result per name for a block that could not run.
 * `prerequisiteOk` distinguishes "nothing to test" from "the lookup broke".
 */
export function unrunResults(
    names: readonly string[],
    prerequisiteOk: boolean,
    whenEmpty: string,
    whenBroken: string,
): TestResult[] {
    return prerequisiteOk ? skippedResults(names, whenEmpty) : failedResults(names, whenBroken);
}

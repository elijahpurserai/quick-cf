/**
 * Test framework types for the in-app test runner.
 */

export interface TestResult {
    name: string;
    passed: boolean;
    /**
     * True when the test could not run because its fixture was absent (e.g. no
     * stories in the DB). `passed` is false for these, but they must be counted
     * and displayed separately — a skip is not a failure. See ./result.
     */
    skipped?: boolean;
    message: string;
    durationMs: number;
    /** Optional extra data (e.g. raw API response) that can be viewed on click */
    details?: any;
}

export interface TestCategory {
    /** Display name for this test group (e.g. "SEO") */
    name: string;
    /** Description shown in the UI */
    description: string;
    /**
     * Run all tests in this category and return results.
     * If onResult is provided, call it for each individual test as it completes (for streaming).
     * If onStart is provided, call it just before each test begins (for showing progress).
     */
    run: (onResult?: (result: TestResult) => void, onStart?: (name: string) => void) => Promise<TestResult[]>;
}

export interface TestRunResponse {
    categories: {
        name: string;
        results: TestResult[];
        passed: number;
        failed: number;
        skipped: number;
    }[];
    totalPassed: number;
    totalFailed: number;
    totalSkipped: number;
    totalDurationMs: number;
}

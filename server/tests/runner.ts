/**
 * Test Runner API Route
 * POST /api/tests/run — runs selected test categories and returns results.
 * Restricted to approved emails only.
 */

import { Router, Response, Request, NextFunction } from "express";
import { authenticateJWT } from "../auth";
import { APPROVED_EMAILS } from "../config";
import { TestCategory, TestRunResponse } from "./types";
import { seoTestCategory } from "./seo";
import { generationTestCategory } from "./generation";
import { privateCreationTestCategory } from "./private_creation";
import { tagsTestCategory } from "./tags";

const testRunnerRoutes = Router();

// Registry of all available test categories
const TEST_CATEGORIES: TestCategory[] = [
    seoTestCategory,
    generationTestCategory,
    privateCreationTestCategory,
    tagsTestCategory,
];

interface AuthRequest extends Request {
    user?: any;
}

// Middleware: restrict to approved emails
const isApproved = (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user || !APPROVED_EMAILS.includes(user.email)) {
        return res.status(403).json({ error: "Unauthorized: Access restricted to approved users." });
    }
    next();
};

// GET /api/tests/categories — list available test categories
testRunnerRoutes.get("/categories", authenticateJWT, isApproved, (_req: AuthRequest, res: Response) => {
    const categories = TEST_CATEGORIES.map(c => ({
        name: c.name,
        description: c.description,
        testCount: c.testCount,
    }));
    res.json({ categories });
});

// POST /api/tests/run — run selected test categories (batch, non-streaming)
testRunnerRoutes.post("/run", authenticateJWT, isApproved, async (req: AuthRequest, res: Response) => {
    const { categories: selectedCategories } = req.body as { categories?: string[] };

    const categoriesToRun = selectedCategories && selectedCategories.length > 0
        ? TEST_CATEGORIES.filter(c => selectedCategories.includes(c.name))
        : TEST_CATEGORIES;

    if (categoriesToRun.length === 0) {
        return res.status(400).json({ error: "No valid test categories specified." });
    }

    const response: TestRunResponse = {
        categories: [],
        totalPassed: 0,
        totalFailed: 0,
        totalDurationMs: 0,
    };

    const overallStart = Date.now();

    for (const category of categoriesToRun) {
        try {
            const results = await category.run();
            const passed = results.filter(r => r.passed).length;
            const failed = results.filter(r => !r.passed).length;

            response.categories.push({
                name: category.name,
                results,
                passed,
                failed,
            });

            response.totalPassed += passed;
            response.totalFailed += failed;
        } catch (err: any) {
            response.categories.push({
                name: category.name,
                results: [{
                    name: "Category execution error",
                    passed: false,
                    message: err.message || String(err),
                    durationMs: 0,
                }],
                passed: 0,
                failed: 1,
            });
            response.totalFailed += 1;
        }
    }

    response.totalDurationMs = Date.now() - overallStart;

    res.json(response);
});

/**
 * GET /api/tests/run/stream?categories=SEO,Content+Generation
 * SSE endpoint — streams individual test results in real-time.
 * 
 * Events:
 *   - "category_start"  { category: string }
 *   - "test_start"      { category: string, name: string }
 *   - "test_result"     { category: string, result: TestResult }
 *   - "category_done"   { category: string, passed: number, failed: number }
 *   - "done"            { totalPassed: number, totalFailed: number, totalDurationMs: number }
 */
testRunnerRoutes.get("/run/stream", authenticateJWT, isApproved, async (req: AuthRequest, res: Response) => {
    // Parse categories from query string
    const categoriesParam = (req.query.categories as string) || "";
    const selectedNames = categoriesParam ? categoriesParam.split(",").map(s => s.trim()) : [];

    const categoriesToRun = selectedNames.length > 0
        ? TEST_CATEGORIES.filter(c => selectedNames.includes(c.name))
        : TEST_CATEGORIES;

    if (categoriesToRun.length === 0) {
        return res.status(400).json({ error: "No valid test categories specified." });
    }

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // for nginx
    res.flushHeaders();

    const send = (event: string, data: any) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    let totalPassed = 0;
    let totalFailed = 0;
    const overallStart = Date.now();

    for (const category of categoriesToRun) {
        send("category_start", { category: category.name });

        try {
            const results = await category.run(
                (result) => { send("test_result", { category: category.name, result }); },
                (name) => { send("test_start", { category: category.name, name }); },
            );

            const passed = results.filter(r => r.passed).length;
            const failed = results.filter(r => !r.passed).length;
            totalPassed += passed;
            totalFailed += failed;

            send("category_done", { category: category.name, passed, failed });
        } catch (err: any) {
            const errorResult = {
                name: "Category execution error",
                passed: false,
                message: err.message || String(err),
                durationMs: 0,
            };
            send("test_result", { category: category.name, result: errorResult });
            send("category_done", { category: category.name, passed: 0, failed: 1 });
            totalFailed += 1;
        }
    }

    send("done", {
        totalPassed,
        totalFailed,
        totalDurationMs: Date.now() - overallStart,
    });

    res.end();
});

export { testRunnerRoutes };

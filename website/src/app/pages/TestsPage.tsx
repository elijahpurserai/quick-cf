import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Play, CheckCircle, XCircle, MinusCircle, Clock, ChevronDown, ChevronUp, Loader2, Shield, Eye, Copy, ClipboardCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { useApp } from "../contexts/AppContext";
import { setNoIndex } from "../utils/seo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface TestResult {
    name: string;
    passed: boolean;
    /** Test could not run because its fixture was absent. Not a failure. */
    skipped?: boolean;
    message: string;
    durationMs: number;
    details?: any;
}

interface CategoryResult {
    name: string;
    results: TestResult[];
    passed: number;
    failed: number;
    skipped: number;
    running?: boolean; // true while category is still in progress
    currentTest?: string; // name of the test currently running
}

interface AvailableCategory {
    name: string;
    description: string;
}

export function TestsPage() {
    const { user } = useApp();
    const navigate = useNavigate();
    const [categories, setCategories] = useState<AvailableCategory[]>([]);
    const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
    const [isRunning, setIsRunning] = useState(false);
    const [categoryResults, setCategoryResults] = useState<CategoryResult[]>([]);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [error, setError] = useState<string | null>(null);
    const [totalPassed, setTotalPassed] = useState(0);
    const [totalFailed, setTotalFailed] = useState(0);
    const [totalSkipped, setTotalSkipped] = useState(0);
    const [totalDurationMs, setTotalDurationMs] = useState(0);
    const [isDone, setIsDone] = useState(false);
    const [detailsModal, setDetailsModal] = useState<{ name: string; data: any } | null>(null);
    const [copied, setCopied] = useState(false);

    // Block non-approved users
    useEffect(() => {
        if (user && !user.isAdmin) {
            navigate("/");
        }
    }, [user, navigate]);

    // noindex
    useEffect(() => {
        setNoIndex(true);
        return () => setNoIndex(false);
    }, []);

    // Fetch available categories
    useEffect(() => {
        const fetchCategories = async () => {
            try {
                const res = await fetch(`${API_URL}/tests/categories`, {
                    credentials: "include",
                });
                if (!res.ok) {
                    if (res.status === 403) {
                        navigate("/");
                        return;
                    }
                    throw new Error("Failed to fetch test categories");
                }
                const data = await res.json();
                setCategories(data.categories);
                setSelectedCategories(new Set(data.categories.map((c: AvailableCategory) => c.name)));
            } catch (err: any) {
                setError(err.message);
            }
        };
        fetchCategories();
    }, [navigate]);

    const toggleCategory = (name: string) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedCategories(new Set(categories.map(c => c.name)));
    };

    const deselectAll = () => {
        setSelectedCategories(new Set());
    };

    const toggleExpanded = (name: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    };

    const buildSummaryText = (): string => {
        const lines: string[] = [];
        lines.push("TEST RESULTS SUMMARY");
        lines.push("====================");
        lines.push(`Total: ${totalPassed + totalFailed + totalSkipped} | Passed: ${totalPassed} | Failed: ${totalFailed}${totalSkipped > 0 ? ` | Skipped: ${totalSkipped}` : ""} | Duration: ${(totalDurationMs / 1000).toFixed(1)}s`);
        lines.push("");

        // Only list failed tests — passed tests are just counted above
        const failedCategories = categoryResults.filter(c => c.failed > 0);
        if (failedCategories.length > 0) {
            lines.push("❌ FAILED TESTS:");
            lines.push("");
            for (const cat of failedCategories) {
                lines.push(`[${cat.name}]`);
                for (const test of cat.results.filter(t => !t.passed && !t.skipped)) {
                    lines.push(`  ✗ ${test.name} — ${test.message}`);
                }
                lines.push("");
            }
        } else {
            lines.push("✅ All tests passed!");
        }

        // Skipped tests are listed too — a skip means a fixture was missing, which is
        // worth seeing even though it is not a failure.
        const skippedCategories = categoryResults.filter(c => c.skipped > 0);
        if (skippedCategories.length > 0) {
            lines.push("");
            lines.push("⊘ SKIPPED TESTS:");
            lines.push("");
            for (const cat of skippedCategories) {
                lines.push(`[${cat.name}]`);
                for (const test of cat.results.filter(t => t.skipped)) {
                    lines.push(`  ⊘ ${test.name} — ${test.message}`);
                }
                lines.push("");
            }
        }

        return lines.join("\n");
    };

    const handleCopySummary = async () => {
        try {
            await navigator.clipboard.writeText(buildSummaryText());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback for older browsers
            const textarea = document.createElement("textarea");
            textarea.value = buildSummaryText();
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const runTests = async () => {
        if (selectedCategories.size === 0) return;

        // Reset state
        setIsRunning(true);
        setCategoryResults([]);
        setError(null);
        setTotalPassed(0);
        setTotalFailed(0);
        setTotalSkipped(0);
        setTotalDurationMs(0);
        setIsDone(false);
        setExpandedCategories(new Set());

        const cats = Array.from(selectedCategories).join(",");
        const url = `${API_URL}/tests/run/stream?categories=${encodeURIComponent(cats)}`;

        try {
            const response = await fetch(url, { credentials: "include" });

            if (!response.ok) {
                throw new Error(`Test run failed: ${response.statusText}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE events from buffer
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // Keep incomplete line in buffer

                let currentEvent = "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ")) {
                        const data = JSON.parse(line.slice(6));
                        handleSSEEvent(currentEvent, data);
                    }
                }
            }
        } catch (err: any) {
            setError(err.message);
            setIsRunning(false);
        }
    };

    const handleSSEEvent = (event: string, data: any) => {
        switch (event) {
            case "category_start":
                setCategoryResults(prev => [
                    ...prev,
                    { name: data.category, results: [], passed: 0, failed: 0, skipped: 0, running: true },
                ]);
                setExpandedCategories(prev => new Set([...prev, data.category]));
                break;

            case "test_start":
                setCategoryResults(prev =>
                    prev.map(cat =>
                        cat.name === data.category ? { ...cat, currentTest: data.name } : cat
                    )
                );
                break;

            case "test_result":
                setCategoryResults(prev =>
                    prev.map(cat => {
                        if (cat.name !== data.category) return cat;
                        return {
                            ...cat,
                            currentTest: undefined,
                            results: [...cat.results, data.result],
                            passed: cat.passed + (data.result.passed ? 1 : 0),
                            failed: cat.failed + (!data.result.passed && !data.result.skipped ? 1 : 0),
                            skipped: cat.skipped + (data.result.skipped ? 1 : 0),
                        };
                    })
                );
                break;

            case "category_done":
                setCategoryResults(prev =>
                    prev.map(cat =>
                        cat.name === data.category ? { ...cat, running: false } : cat
                    )
                );
                break;

            case "done":
                setTotalPassed(data.totalPassed);
                setTotalFailed(data.totalFailed);
                setTotalSkipped(data.totalSkipped ?? 0);
                setTotalDurationMs(data.totalDurationMs);
                setIsDone(true);
                setIsRunning(false);
                break;
        }
    };

    if (!user || !user.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-24 text-center">
                <Shield className="size-16 text-gray-300 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-700">Access Restricted</h1>
                <p className="text-gray-500 mt-2">This page is only available to approved users.</p>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Test Runner</h1>
                <p className="text-gray-500 mt-1">Run automated tests to verify site health and configuration.</p>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {/* Category Selection */}
            <div className="mb-6 bg-white border border-gray-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">Test Categories</h2>
                    <div className="flex gap-2">
                        <button onClick={selectAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            Select All
                        </button>
                        <span className="text-gray-300">|</span>
                        <button onClick={deselectAll} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                            Deselect All
                        </button>
                    </div>
                </div>
                <div className="space-y-3">
                    {categories.map(cat => {
                        const lastResult = categoryResults.find(r => r.name === cat.name);
                        return (
                        <label
                            key={cat.name}
                            className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                            <input
                                type="checkbox"
                                checked={selectedCategories.has(cat.name)}
                                onChange={() => toggleCategory(cat.name)}
                                className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                disabled={isRunning}
                            />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">{cat.name}</span>
                                    {lastResult && !lastResult.running ? (
                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${lastResult.failed === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                                            {lastResult.results.length} tests · {lastResult.passed} passed{lastResult.failed > 0 ? ` · ${lastResult.failed} failed` : ""}{lastResult.skipped > 0 ? ` · ${lastResult.skipped} skipped` : ""}
                                        </span>
                                    ) : null}
                                </div>
                                <p className="text-sm text-gray-500">{cat.description}</p>
                            </div>
                        </label>
                        );
                    })}
                    {categories.length === 0 && !error && (
                        <p className="text-gray-400 text-sm">Loading categories...</p>
                    )}
                </div>
            </div>

            {/* Run Button */}
            <div className="mb-8">
                <Button
                    onClick={runTests}
                    disabled={isRunning || selectedCategories.size === 0}
                    size="lg"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8"
                >
                    {isRunning ? (
                        <>
                            <Loader2 className="size-5 mr-2 animate-spin" />
                            Running Tests...
                        </>
                    ) : (
                        <>
                            <Play className="size-5 mr-2" />
                            Run {selectedCategories.size === categories.length ? "All" : "Selected"} Tests
                        </>
                    )}
                </Button>
            </div>

            {/* Results */}
            {categoryResults.length > 0 && (
                <div>
                    {/* Summary Banner — only show when done */}
                    {isDone && (
                        <div className={`mb-6 p-5 rounded-xl border-2 ${totalFailed === 0
                            ? "bg-green-50 border-green-200"
                            : "bg-red-50 border-red-200"
                            }`}>
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {totalFailed === 0 ? (
                                        <CheckCircle className="size-8 text-green-600" />
                                    ) : (
                                        <XCircle className="size-8 text-red-600" />
                                    )}
                                    <div>
                                        <h3 className={`text-xl font-bold ${totalFailed === 0 ? "text-green-800" : "text-red-800"
                                            }`}>
                                            {totalFailed === 0
                                                ? "All Tests Passed!"
                                                : `${totalFailed} Test${totalFailed > 1 ? "s" : ""} Failed`
                                            }
                                        </h3>
                                        <p className="text-sm text-gray-600">
                                            {totalPassed} passed · {totalFailed} failed{totalSkipped > 0 ? ` · ${totalSkipped} skipped` : ""} · {totalDurationMs}ms total
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 text-gray-500">
                                    <Clock className="size-4" />
                                    <span className="text-sm">{(totalDurationMs / 1000).toFixed(1)}s</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Detailed Summary with Copy — shown when done */}
                    {isDone && (
                        <div className="mb-6 bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700">
                                <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
                                    {totalFailed > 0 ? "Failure Summary" : "Test Summary"}
                                </h3>
                                <button
                                    onClick={handleCopySummary}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${copied
                                        ? "bg-green-600 text-white"
                                        : "bg-gray-700 text-gray-200 hover:bg-gray-600"
                                        }`}
                                >
                                    {copied ? (
                                        <>
                                            <ClipboardCheck className="size-4" />
                                            Copied!
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="size-4" />
                                            Copy Summary
                                        </>
                                    )}
                                </button>
                            </div>
                            <pre className="px-5 py-4 text-sm text-gray-100 font-mono whitespace-pre-wrap overflow-auto max-h-[400px] leading-relaxed">
                                {buildSummaryText()}
                            </pre>
                        </div>
                    )}

                    {/* Category Results */}
                    <div className="space-y-4">
                        {categoryResults.map(cat => (
                            <div key={cat.name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                {/* Category Header */}
                                <button
                                    onClick={() => toggleExpanded(cat.name)}
                                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        {cat.running ? (
                                            <Loader2 className="size-5 text-blue-500 animate-spin" />
                                        ) : cat.failed === 0 ? (
                                            <CheckCircle className="size-5 text-green-500" />
                                        ) : (
                                            <XCircle className="size-5 text-red-500" />
                                        )}
                                        <span className="font-semibold text-gray-900">{cat.name}</span>
                                        <span className="text-sm text-gray-500">
                                            {cat.results.length} test{cat.results.length !== 1 ? "s" : ""}
                                            {cat.running ? " (running...)" : ` · ${cat.passed} passed${cat.failed > 0 ? `, ${cat.failed} failed` : ""}${cat.skipped > 0 ? `, ${cat.skipped} skipped` : ""}`}
                                        </span>
                                    </div>
                                    {expandedCategories.has(cat.name) ? (
                                        <ChevronUp className="size-5 text-gray-400" />
                                    ) : (
                                        <ChevronDown className="size-5 text-gray-400" />
                                    )}
                                </button>

                                {/* Test Results Table */}
                                {expandedCategories.has(cat.name) && (
                                    <div className="border-t border-gray-100">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 text-left text-gray-500">
                                                    <th className="px-4 py-2 w-8"></th>
                                                    <th className="px-4 py-2">Test</th>
                                                    <th className="px-4 py-2">Result</th>
                                                    <th className="px-4 py-2 w-20 text-right">Time</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cat.results.map((test, i) => (
                                                    <tr
                                                        key={i}
                                                        className={`border-t border-gray-50 ${test.skipped ? "bg-amber-50/40" : !test.passed ? "bg-red-50/50" : ""
                                                            } animate-fade-in`}
                                                    >
                                                        <td className="px-4 py-2.5">
                                                            {test.skipped ? (
                                                                <MinusCircle className="size-4 text-amber-500" />
                                                            ) : test.passed ? (
                                                                <CheckCircle className="size-4 text-green-500" />
                                                            ) : (
                                                                <XCircle className="size-4 text-red-500" />
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 font-medium text-gray-800">
                                                            <div className="flex items-center gap-2">
                                                                {test.name}
                                                                {test.details && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setDetailsModal({ name: test.name, data: test.details });
                                                                        }}
                                                                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors"
                                                                        title="View response JSON"
                                                                    >
                                                                        <Eye className="size-3" />
                                                                        JSON
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">
                                                            {test.skipped ? (
                                                                <span className="text-amber-600">{test.message}</span>
                                                            ) : test.passed ? (
                                                                <span className="text-green-600">Passed</span>
                                                            ) : (
                                                                <span className="text-red-600">{test.message}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-gray-400">
                                                            {test.durationMs}ms
                                                        </td>
                                                    </tr>
                                                ))}
                                                {cat.running && (
                                                    <tr className="border-t border-gray-50">
                                                        <td className="px-4 py-2.5">
                                                            <Loader2 className="size-4 text-blue-400 animate-spin" />
                                                        </td>
                                                        <td className="px-4 py-2.5 text-gray-500 italic" colSpan={3}>
                                                            {cat.currentTest ?? "Starting..."}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {detailsModal && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setDetailsModal(null)}
                >
                    <div
                        className="bg-white rounded-xl max-w-3xl w-full max-h-[80vh] flex flex-col overflow-hidden shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="font-semibold text-gray-900 truncate">{detailsModal.name}</h3>
                            <button
                                onClick={() => setDetailsModal(null)}
                                className="text-gray-400 hover:text-gray-600 text-xl font-bold px-2"
                            >
                                ×
                            </button>
                        </div>
                        <div className="p-4 overflow-auto flex-1">
                            <pre className="text-sm text-gray-800 bg-gray-50 p-4 rounded-lg overflow-auto whitespace-pre-wrap font-mono">
                                {JSON.stringify(detailsModal.data, null, 2)}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

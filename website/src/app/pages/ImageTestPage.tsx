import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
    Shield, Loader2, Play, ImageIcon, Settings2, ChevronDown, ChevronUp,
    AlertCircle, Check, RefreshCw, Clock, HardDrive
} from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useLanguage } from "../contexts/LanguageContext";
import { setNoIndex } from "../utils/seo";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

interface TestStory {
    id: string;
    title: string;
    description: string;
    imageUrl: string;
    imagePrompt: string;
    hasOriginalPrompt?: boolean;
}

interface ImageResult {
    tempImageUrl: string | null;
    revisedPrompt: string | null;
    finalPrompt: string;
    error?: string;
    durationMs?: number;
    newImageBytes?: number | null;
    compressedImageBytes?: number | null;
    newDimensions?: { width: number; height: number };
    currentDimensions?: { width: number; height: number };
    currentImageBytes?: number | null;
}

interface ImageSettings {
    model: string;
    size: string;
    quality: string;
    style: string;
    promptTemplate: string;
}

const DEFAULT_SETTINGS: ImageSettings = {
    model: "dall-e-3",
    size: "1792x1024",
    quality: "standard",
    style: "vivid",
    promptTemplate: "",
};

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve) => {
        const img = new window.Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => resolve({ width: 0, height: 0 });
        img.src = url;
    });
}

/** Fetch image as blob to get accurate file size in bytes */
async function getImageFileSize(url: string): Promise<number | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        return blob.size;
    } catch {
        return null;
    }
}

function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null || bytes === 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number | undefined): string {
    if (ms == null) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
}

export function ImageTestPage() {
    const { user } = useApp();
    const { t } = useLanguage();
    const navigate = useNavigate();

    const [stories, setStories] = useState<TestStory[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [results, setResults] = useState<Map<string, ImageResult>>(new Map());
    const [settings, setSettings] = useState<ImageSettings>(DEFAULT_SETTINGS);
    const [fallbackTemplate, setFallbackTemplate] = useState("");
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [showSettings, setShowSettings] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [totalDuration, setTotalDuration] = useState<number | null>(null);
    const abortRef = useRef<AbortController | null>(null);

    // Block non-admin
    useEffect(() => {
        if (user && !user.isAdmin) navigate("/");
    }, [user, navigate]);

    // noindex
    useEffect(() => {
        setNoIndex(true);
        return () => setNoIndex(false);
    }, []);

    // Fetch stories
    const fetchStories = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/admin/image-test-stories`, { credentials: "include" });
            if (!res.ok) {
                if (res.status === 403) { navigate("/"); return; }
                throw new Error("Failed to fetch stories");
            }
            const json = await res.json();
            const fetchedStories = json.stories || [];
            setStories(fetchedStories);
            // Default to first 5 selected
            setSelectedIds(new Set(fetchedStories.slice(0, 5).map((s: TestStory) => s.id)));
            // Pre-fill settings from server current config
            if (json.currentSettings) {
                setSettings((prev) => ({
                    ...prev,
                    model: json.currentSettings.model || prev.model,
                    size: json.currentSettings.size || prev.size,
                    quality: json.currentSettings.quality || prev.quality,
                    style: json.currentSettings.style || prev.style,
                }));
            }
            // Store fallback template for reference
            if (json.fallbackPromptTemplate) {
                setFallbackTemplate(json.fallbackPromptTemplate);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [navigate]);

    useEffect(() => { fetchStories(); }, [fetchStories]);

    // Toggle story selection
    const toggleStory = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => setSelectedIds(new Set(stories.map((s) => s.id)));
    const selectNone = () => setSelectedIds(new Set());

    // Run test — all images generated in parallel on the server
    const runTest = async () => {
        const selected = stories.filter((s) => selectedIds.has(s.id));
        if (selected.length === 0) return;

        setRunning(true);
        setResults(new Map());
        setShowSettings(false);
        setTotalDuration(null);

        const controller = new AbortController();
        abortRef.current = controller;
        const startTime = Date.now();

        try {
            const res = await fetch(`${API_URL}/admin/image-test-generate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    stories: selected.map((s) => ({ id: s.id, imagePrompt: s.imagePrompt })),
                    settings,
                }),
                signal: controller.signal,
            });

            if (!res.ok) throw new Error("Failed to start image generation");

            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || "";

                let currentEvent = "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7);
                    } else if (line.startsWith("data: ") && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (currentEvent === "result") {
                                const result: ImageResult = {
                                    tempImageUrl: data.tempImageUrl,
                                    revisedPrompt: data.revisedPrompt,
                                    finalPrompt: data.finalPrompt,
                                    durationMs: data.durationMs,
                                    newImageBytes: data.newImageBytes,
                                    compressedImageBytes: data.compressedImageBytes,
                                };
                                setResults((prev) => new Map(prev).set(data.storyId, result));

                                // Load dimensions for new image
                                if (data.tempImageUrl) {
                                    getImageDimensions(data.tempImageUrl).then((dims) => {
                                        setResults((prev) => {
                                            const next = new Map(prev);
                                            const existing = next.get(data.storyId);
                                            if (existing) next.set(data.storyId, { ...existing, newDimensions: dims });
                                            return next;
                                        });
                                    });
                                }
                            } else if (currentEvent === "error") {
                                setResults((prev) =>
                                    new Map(prev).set(data.storyId, {
                                        tempImageUrl: null,
                                        revisedPrompt: null,
                                        finalPrompt: "",
                                        error: data.error,
                                        durationMs: data.durationMs,
                                    })
                                );
                            } else if (currentEvent === "done") {
                                setTotalDuration(Date.now() - startTime);
                            }
                        } catch { /* skip malformed JSON */ }
                        currentEvent = "";
                    }
                }
            }
        } catch (err: any) {
            if (err.name !== "AbortError") {
                setError(err.message);
            }
        } finally {
            setRunning(false);
            abortRef.current = null;
            if (!totalDuration) setTotalDuration(Date.now() - startTime);
        }
    };

    const stopTest = () => {
        abortRef.current?.abort();
        setRunning(false);
    };

    // Load current image dimensions + file size lazily once results start appearing
    useEffect(() => {
        for (const story of stories) {
            if (story.imageUrl && results.has(story.id)) {
                const existing = results.get(story.id)!;
                // Only fetch once
                if (existing.currentDimensions || existing.currentImageBytes !== undefined) continue;

                getImageDimensions(story.imageUrl).then((dims) => {
                    setResults((prev) => {
                        const next = new Map(prev);
                        const r = next.get(story.id);
                        if (r) next.set(story.id, { ...r, currentDimensions: dims });
                        return next;
                    });
                });

                getImageFileSize(story.imageUrl).then((bytes) => {
                    setResults((prev) => {
                        const next = new Map(prev);
                        const r = next.get(story.id);
                        if (r) next.set(story.id, { ...r, currentImageBytes: bytes });
                        return next;
                    });
                });
            }
        }
    }, [stories, results]);

    if (!user || !user.isAdmin) {
        return (
            <div className="max-w-4xl mx-auto px-4 py-24 text-center">
                <Shield className="size-16 text-gray-300 mx-auto mb-4" />
                <h1 className="text-2xl font-bold text-gray-700">{t("imageTest.accessRestricted")}</h1>
            </div>
        );
    }

    const completedCount = Array.from(results.values()).filter((r) => r.tempImageUrl || r.error).length;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-600 to-rose-600 bg-clip-text text-transparent">
                        {t("imageTest.title")}
                    </h1>
                    <p className="text-gray-500 mt-1">{t("imageTest.subtitle")}</p>
                </div>
                <button
                    onClick={fetchStories}
                    disabled={loading || running}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
                    {t("imageTest.refreshStories")}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center gap-2">
                    <AlertCircle className="size-5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Settings Panel */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm mb-8">
                <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors rounded-xl"
                >
                    <div className="flex items-center gap-2">
                        <Settings2 className="size-5 text-gray-500" />
                        <h2 className="text-lg font-semibold text-gray-900">{t("imageTest.settingsTitle")}</h2>
                    </div>
                    {showSettings ? <ChevronUp className="size-5 text-gray-400" /> : <ChevronDown className="size-5 text-gray-400" />}
                </button>
                {showSettings && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            {/* Model */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("imageTest.model")}</label>
                                <select
                                    value={settings.model}
                                    onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="dall-e-3">DALL-E 3</option>
                                    <option value="dall-e-2">DALL-E 2</option>
                                </select>
                            </div>
                            {/* Size */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("imageTest.size")}</label>
                                <select
                                    value={settings.size}
                                    onChange={(e) => setSettings((s) => ({ ...s, size: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="1792x1024">1792×1024 (Landscape)</option>
                                    <option value="1024x1024">1024×1024 (Square)</option>
                                    <option value="1024x1792">1024×1792 (Portrait)</option>
                                </select>
                            </div>
                            {/* Quality */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("imageTest.quality")}</label>
                                <select
                                    value={settings.quality}
                                    onChange={(e) => setSettings((s) => ({ ...s, quality: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="standard">Standard</option>
                                    <option value="hd">HD</option>
                                </select>
                            </div>
                            {/* Style */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("imageTest.style")}</label>
                                <select
                                    value={settings.style}
                                    onChange={(e) => setSettings((s) => ({ ...s, style: e.target.value }))}
                                    className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500"
                                >
                                    <option value="natural">Natural</option>
                                    <option value="vivid">Vivid</option>
                                </select>
                            </div>
                        </div>

                        {/* Prompt Template */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    {t("imageTest.promptTemplate")}
                                </label>
                                <div className="flex gap-2">
                                    {fallbackTemplate && (
                                        <button
                                            type="button"
                                            onClick={() => setSettings((s) => ({ ...s, promptTemplate: fallbackTemplate }))}
                                            className="text-xs text-orange-600 hover:underline"
                                        >
                                            {t("imageTest.loadFallback")}
                                        </button>
                                    )}
                                    {settings.promptTemplate && (
                                        <button
                                            type="button"
                                            onClick={() => setSettings((s) => ({ ...s, promptTemplate: "" }))}
                                            className="text-xs text-gray-400 hover:underline"
                                        >
                                            {t("imageTest.clearTemplate")}
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{t("imageTest.promptTemplateHint")}</p>
                            <textarea
                                value={settings.promptTemplate}
                                onChange={(e) => setSettings((s) => ({ ...s, promptTemplate: e.target.value }))}
                                placeholder={t("imageTest.promptTemplatePlaceholder")}
                                rows={4}
                                className="w-full rounded-lg border-gray-300 shadow-sm text-sm focus:ring-orange-500 focus:border-orange-500 font-mono"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Loading */}
            {loading && (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="size-8 text-orange-500 animate-spin" />
                </div>
            )}

            {/* Stories List */}
            {!loading && stories.length > 0 && (
                <>
                    {/* Selection Controls + Progress */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-500">
                                {t("imageTest.selectedCount", { selected: selectedIds.size, total: stories.length })}
                            </span>
                            <button onClick={selectAll} className="text-xs text-orange-600 hover:underline">{t("imageTest.selectAll")}</button>
                            <button onClick={selectNone} className="text-xs text-orange-600 hover:underline">{t("imageTest.selectNone")}</button>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Progress / Total time */}
                            {(running || totalDuration) && (
                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                    <Clock className="size-3.5" />
                                    {running
                                        ? t("imageTest.generating", { done: completedCount, total: selectedIds.size })
                                        : totalDuration
                                            ? t("imageTest.totalTime", { time: formatDuration(totalDuration) })
                                            : null}
                                </span>
                            )}
                            {running ? (
                                <button
                                    onClick={stopTest}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium text-sm"
                                >
                                    {t("imageTest.stop")}
                                </button>
                            ) : (
                                <button
                                    onClick={runTest}
                                    disabled={selectedIds.size === 0}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-lg hover:from-orange-700 hover:to-rose-700 transition-colors font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <Play className="size-4" />
                                    {t("imageTest.runTest")}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Story Cards */}
                    <div className="space-y-6">
                        {stories.map((story) => {
                            const result = results.get(story.id);
                            const isSelected = selectedIds.has(story.id);

                            return (
                                <div
                                    key={story.id}
                                    className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
                                        isSelected ? "border-orange-300 ring-1 ring-orange-200" : "border-gray-200 opacity-60"
                                    }`}
                                >
                                    {/* Story Header */}
                                    <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => toggleStory(story.id)}
                                            className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-gray-900 truncate">{story.title}</h3>
                                                {story.hasOriginalPrompt === false && (
                                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
                                                        {t("imageTest.fallbackPrompt")}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-gray-400 truncate">{story.description}</p>
                                        </div>
                                        {/* Status + Duration badge */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            {result?.durationMs != null && !result.error && (
                                                <span className="text-xs text-gray-400 flex items-center gap-1">
                                                    <Clock className="size-3" />
                                                    {formatDuration(result.durationMs)}
                                                </span>
                                            )}
                                            {result && !result.error && result.tempImageUrl && (
                                                <Check className="size-5 text-green-500" />
                                            )}
                                            {result?.error && (
                                                <AlertCircle className="size-5 text-red-500" />
                                            )}
                                            {running && !result && isSelected && (
                                                <Loader2 className="size-5 text-orange-500 animate-spin" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Image Comparison */}
                                    {(story.imageUrl || result) && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:divide-x divide-gray-100">
                                            {/* Current Image */}
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        {t("imageTest.currentImage")}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                                        {result?.currentDimensions && result.currentDimensions.width > 0 && (
                                                            <span>{result.currentDimensions.width}×{result.currentDimensions.height}</span>
                                                        )}
                                                        {result?.currentImageBytes != null && result.currentImageBytes > 0 && (
                                                            <span className="flex items-center gap-0.5">
                                                                <HardDrive className="size-3" />
                                                                {formatBytes(result.currentImageBytes)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {story.imageUrl ? (
                                                    <img
                                                        src={story.imageUrl}
                                                        alt={story.title}
                                                        className="w-full rounded-lg object-cover aspect-video bg-gray-100"
                                                    />
                                                ) : (
                                                    <div className="w-full rounded-lg bg-gray-100 aspect-video flex items-center justify-center">
                                                        <ImageIcon className="size-8 text-gray-300" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* New Image */}
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-medium text-orange-500 uppercase tracking-wider">
                                                        {t("imageTest.newImage")}
                                                    </span>
                                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                                        {result?.newDimensions && result.newDimensions.width > 0 && (
                                                            <span>{result.newDimensions.width}×{result.newDimensions.height}</span>
                                                        )}
                                                        {result?.newImageBytes != null && result.newImageBytes > 0 && (
                                                            <span className="flex items-center gap-0.5 text-gray-300 line-through">
                                                                {formatBytes(result.newImageBytes)}
                                                            </span>
                                                        )}
                                                        {result?.compressedImageBytes != null && result.compressedImageBytes > 0 && (
                                                            <span className={`flex items-center gap-0.5 font-medium ${
                                                                result.compressedImageBytes > 500 * 1024 ? "text-red-500" : "text-green-600"
                                                            }`}>
                                                                <HardDrive className="size-3" />
                                                                {formatBytes(result.compressedImageBytes)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {result?.tempImageUrl ? (
                                                    <img
                                                        src={result.tempImageUrl}
                                                        alt={`New: ${story.title}`}
                                                        className="w-full rounded-lg object-cover aspect-video bg-gray-100"
                                                    />
                                                ) : result?.error ? (
                                                    <div className="w-full rounded-lg bg-red-50 aspect-video flex items-center justify-center text-red-500 text-sm px-4 text-center">
                                                        {result.error}
                                                    </div>
                                                ) : (
                                                    <div className="w-full rounded-lg bg-gray-50 aspect-video flex items-center justify-center">
                                                        {running && isSelected ? (
                                                            <Loader2 className="size-8 text-orange-300 animate-spin" />
                                                        ) : (
                                                            <span className="text-sm text-gray-300">{t("imageTest.pendingGeneration")}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Prompt Details (collapsible) */}
                                    {result?.revisedPrompt && (
                                        <details className="px-5 pb-4">
                                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                                                {t("imageTest.revisedPrompt")}
                                            </summary>
                                            <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded-lg p-3 font-mono whitespace-pre-wrap">
                                                {result.revisedPrompt}
                                            </p>
                                        </details>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* Empty State */}
            {!loading && stories.length === 0 && (
                <div className="text-center py-24">
                    <ImageIcon className="size-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-600">{t("imageTest.noStories")}</h2>
                    <p className="text-gray-400 mt-1">{t("imageTest.noStoriesHint")}</p>
                </div>
            )}
        </div>
    );
}

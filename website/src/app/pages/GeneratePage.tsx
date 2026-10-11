import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Sparkles, BookOpen, Loader2, Check, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Checkbox } from "../components/ui/checkbox";
import { Progress } from "../components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import { api } from "../services/api";
import { useApp } from "../contexts/AppContext";
import { useLanguage } from "../contexts/LanguageContext";
import { setNoIndex } from "../utils/seo";
import { uiLangForContent } from "../i18n";
import { EDUCATION_CATEGORIES, EDUCATION_CATEGORY_KEYS } from "../types";
import { SUPPORTED_LANGUAGES } from "../config";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

/** Sentinel for "let the model rotate through every education category". */
const ALL_CATEGORIES = "all";

/**
 * Total-idea presets. The server splits any total into calls of 50 — asking one
 * call for more than that reliably under-delivers.
 */
const IDEA_COUNT_OPTIONS = [50, 100, 150, 200, 300, 400, 500];

interface Suggestion {
    title: string;
    prompt: string;
    selected: boolean;
    status: "idle" | "pending" | "success" | "error";
    error?: string;
    resultId?: string;
    /** Slug of the Creation this row produced — used to link to it. */
    resultSlug?: string;
    /** The Creation's own language, which decides its URL prefix. */
    resultLang?: string;
    /** Story or Lesson — captured per row, since the tab can change afterwards. */
    resultType?: "story" | "lesson";
}

export function GeneratePage() {
    const { user } = useApp();
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"story" | "lesson">("story");
    const [basePrompt, setBasePrompt] = useState("");
    const [ideaCount, setIdeaCount] = useState(100);
    const [category, setCategory] = useState<string>(ALL_CATEGORIES);
    const [contentLang, setContentLang] = useState("en");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [isExecuting, setIsExecuting] = useState(false);
    const [progress, setProgress] = useState(0);

    // Authentication check and SEO
    useEffect(() => {
        setNoIndex(true);
        if (user && !user.isAdmin) {
            toast.error(t("toast.unauthorized"));
            navigate("/");
        }
        return () => setNoIndex(false);
    }, [user, navigate]);

    const handleSuggest = async () => {
        if (!basePrompt.trim()) {
            toast.error(t("toast.enterPrompt"));
            return;
        }

        setIsSuggesting(true);
        setSuggestions([]);

        try {
            const response = await api.post("/generator/suggest-prompts", {
                type: activeTab,
                basePrompt,
                count: ideaCount,
                // Category only means something for stories; lessons have none.
                category: activeTab === "story" ? category : undefined,
                language: contentLang,
            });

            const items = (response.suggestions || []).map((s: any) => ({
                ...s,
                selected: true,
                status: "idle" as const,
            }));
            setSuggestions(items);

            // Independent chunks overlap, so a big ask can land short after dedupe.
            // Say so rather than silently returning fewer than requested.
            if (response.requested && items.length < response.requested) {
                toast.warning(t("generate.shortOfTarget", {
                    received: items.length,
                    requested: response.requested,
                    duplicates: response.duplicatesRemoved ?? 0,
                }));
            } else {
                toast.success(t("toast.suggestionsGenerated", { count: items.length }));
            }
        } catch (error) {
            console.error(error);
            toast.error(t("toast.suggestionsFailed"));
        } finally {
            setIsSuggesting(false);
        }
    };

    /**
     * URL of the Creation a row produced, or null if the row hasn't produced one.
     *
     * Built under the Creation's OWN language prefix, not the admin's current UI
     * language — a Hebrew story lives at /he/story/<slug>. The server 301s a wrong
     * prefix, but linking correctly avoids the redirect hop entirely.
     */
    const creationHref = (s: Suggestion): string | null => {
        if (!s.resultSlug || !s.resultType) return null;
        return `/${uiLangForContent(s.resultLang)}/${s.resultType}/${s.resultSlug}`;
    };

    const toggleSelectAll = (checked: boolean) => {
        setSuggestions(prev => prev.map(s => ({ ...s, selected: checked })));
    };

    const handleExecute = async () => {
        const selectedItems = suggestions
            .map((s, i) => ({ ...s, originalIndex: i }))
            .filter(s => s.selected && s.status !== "success");

        if (selectedItems.length === 0) {
            toast.error(t("toast.noSuggestionsSelected"));
            return;
        }

        setIsExecuting(true);
        setProgress(0);

        // Mark all selected items as pending
        setSuggestions(prev => {
            const next = [...prev];
            for (const item of selectedItems) {
                next[item.originalIndex] = { ...next[item.originalIndex], status: "pending" };
            }
            return next;
        });

        // Pin the type for this run: activeTab can be switched while the batch is
        // still streaming, and each row's link must point at what it actually created.
        const batchType = activeTab;

        // Build the batch payload — items array with index mapping
        const items = selectedItems.map(s => ({ title: s.title, prompt: s.prompt }));
        // Map from batch index → original suggestions index
        const indexMap = selectedItems.map(s => s.originalIndex);

        try {
            const response = await fetch(`${API_URL}/generator/generate-seed-batch/stream`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    type: batchType,
                    items,
                    category: batchType === "story" ? category : undefined,
                    language: contentLang,
                }),
            });

            if (!response.ok || !response.body) {
                throw new Error(`Server returned ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let completedCount = 0;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() || ""; // keep incomplete line in buffer

                let currentEvent = "";
                for (const line of lines) {
                    if (line.startsWith("event: ")) {
                        currentEvent = line.slice(7).trim();
                    } else if (line.startsWith("data: ") && currentEvent) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const originalIndex = indexMap[data.index];

                            switch (currentEvent) {
                                case "item_start":
                                    setSuggestions(prev => {
                                        const next = [...prev];
                                        next[originalIndex] = { ...next[originalIndex], status: "pending" };
                                        return next;
                                    });
                                    break;
                                case "item_done":
                                    completedCount++;
                                    setProgress((completedCount / selectedItems.length) * 100);
                                    setSuggestions(prev => {
                                        const next = [...prev];
                                        next[originalIndex] = {
                                            ...next[originalIndex],
                                            status: "success",
                                            resultId: data.id,
                                            resultSlug: data.slug,
                                            resultLang: data.language,
                                            resultType: batchType,
                                        };
                                        return next;
                                    });
                                    break;
                                case "item_error":
                                    completedCount++;
                                    setProgress((completedCount / selectedItems.length) * 100);
                                    setSuggestions(prev => {
                                        const next = [...prev];
                                        next[originalIndex] = { ...next[originalIndex], status: "error", error: data.error };
                                        return next;
                                    });
                                    break;
                                case "image_done":
                                    console.log(`[Image] Generated for: ${data.title}`);
                                    break;
                                case "image_error":
                                    console.error(`[Image] Failed for ${data.id}:`, data.error);
                                    break;
                                case "done":
                                    toast.success(t("toast.batchComplete", { succeeded: data.succeeded, failed: data.failed }));
                                    break;
                            }
                        } catch {
                            // skip malformed JSON
                        }
                        currentEvent = "";
                    }
                }
            }
        } catch (error) {
            console.error("Batch SSE error:", error);
            toast.error(t("toast.batchFailed"));
        } finally {
            setIsExecuting(false);
        }
    };

    if (!user || !user.isAdmin) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <AlertCircle className="size-12 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold">Unauthorized</h1>
                    <p className="text-gray-600">You do not have permission to access this page.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto px-4 py-12">
            <div className="mb-8 overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 p-8 text-white shadow-xl">
                <h1 className="text-4xl font-bold mb-2">Content Seed Generator</h1>
                <p className="text-purple-100 opacity-90">
                    Batch generate high-quality stories and lessons to seed the website.
                </p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border p-6 mb-8">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="story" className="text-lg py-2">
                            <Sparkles className="size-4 mr-2" /> Stories
                        </TabsTrigger>
                        <TabsTrigger value="lesson" className="text-lg py-2">
                            <BookOpen className="size-4 mr-2" /> Lessons
                        </TabsTrigger>
                    </TabsList>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Base Instruction / Theme
                            </label>
                            <Input
                                placeholder="e.g., Bedtime stories about space travel for toddlers"
                                value={basePrompt}
                                onChange={(e) => setBasePrompt(e.target.value)}
                                disabled={isSuggesting || isExecuting}
                            />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label>{t("generate.ideaCount")}</Label>
                                <Select
                                    value={String(ideaCount)}
                                    onValueChange={(v) => setIdeaCount(Number(v))}
                                    disabled={isSuggesting || isExecuting}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {IDEA_COUNT_OPTIONS.map((n) => (
                                            <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>{t("generate.language")}</Label>
                                <Select
                                    value={contentLang}
                                    onValueChange={setContentLang}
                                    disabled={isSuggesting || isExecuting}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SUPPORTED_LANGUAGES.map((lang) => (
                                            <SelectItem key={lang.code} value={lang.code}>{lang.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Education category applies to Stories only — Lessons have none. */}
                            {activeTab === "story" && (
                                <div className="space-y-2">
                                    <Label>{t("generate.category")}</Label>
                                    <Select
                                        value={category}
                                        onValueChange={setCategory}
                                        disabled={isSuggesting || isExecuting}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={ALL_CATEGORIES}>{t("generate.allCategories")}</SelectItem>
                                            {EDUCATION_CATEGORIES.filter(cat => cat !== "Other").map((cat) => (
                                                <SelectItem key={cat} value={cat}>{t(EDUCATION_CATEGORY_KEYS[cat] || cat)}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={handleSuggest}
                            disabled={isSuggesting || isExecuting}
                            className="w-full h-12 text-lg"
                        >
                            {isSuggesting ? <Loader2 className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
                            {t("generate.suggestPrompts", { count: ideaCount })}
                        </Button>
                    </div>
                </Tabs>
            </div>

            {suggestions.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                    <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="select-all"
                                    checked={suggestions.every(s => s.selected)}
                                    onCheckedChange={(checked) => toggleSelectAll(!!checked)}
                                />
                                <label htmlFor="select-all" className="text-sm font-medium">Select All</label>
                            </div>
                            <span className="text-sm text-gray-500">
                                {suggestions.filter(s => s.selected).length} selected
                            </span>
                        </div>

                        <Button
                            onClick={handleExecute}
                            disabled={isExecuting || suggestions.filter(s => s.selected).length === 0}
                            className="bg-green-600 hover:bg-green-700 h-10 px-6"
                        >
                            {isExecuting ? <Loader2 className="animate-spin mr-2" /> : null}
                            Execute Batch
                        </Button>
                    </div>

                    {isExecuting && (
                        <div className="p-4 bg-blue-50 border-b">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-blue-700">Execution Progress</span>
                                <span className="text-sm font-medium text-blue-700">{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                        </div>
                    )}

                    <div className="max-h-[600px] overflow-y-auto divide-y">
                        {suggestions.map((suggestion, index) => (
                            <div key={index} className="p-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                                <Checkbox
                                    checked={suggestion.selected}
                                    onCheckedChange={(checked) => {
                                        const newSuggestions = [...suggestions];
                                        newSuggestions[index].selected = !!checked;
                                        setSuggestions(newSuggestions);
                                    }}
                                    disabled={isExecuting || suggestion.status === "success"}
                                    className="mt-1"
                                />
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 truncate">{suggestion.title}</h3>
                                    <p className="text-sm text-gray-500 line-clamp-2">{suggestion.prompt}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {suggestion.status === "success" && creationHref(suggestion) && (
                                        <a
                                            href={creationHref(suggestion)!}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline whitespace-nowrap"
                                        >
                                            {suggestion.resultType === "lesson" ? t("generate.viewLesson") : t("generate.viewStory")}
                                            <ExternalLink className="size-3.5" />
                                        </a>
                                    )}
                                    {suggestion.status === "pending" && <Loader2 className="size-5 text-blue-500 animate-spin" />}
                                    {suggestion.status === "success" && <Check className="size-5 text-green-500" />}
                                    {suggestion.status === "error" && <AlertCircle className="size-5 text-red-500" />}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

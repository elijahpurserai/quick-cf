import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { BookOpen, Sparkles, Lock, Globe, Check, Link2 } from "lucide-react";
import { LESSON_LEVELS, LESSON_TONES, DURATION_OPTIONS, LessonFormData, Visibility } from "../types";
import { SUPPORTED_LANGUAGES } from "../config";
import { useLanguage } from "../contexts/LanguageContext";
import { useApp } from "../contexts/AppContext";
import { LoginRequiredModal } from "./LoginRequiredModal";

const LESSON_LANG_KEY = "quick_lesson_language";

// Maps English level values to i18n keys
const LEVEL_KEYS: Record<string, string> = {
    "Preschool (3-5)": "lessonForm.levelPreschool",
    "Elementary (6-10)": "lessonForm.levelElementary",
    "Middle School (11-13)": "lessonForm.levelMiddle",
    "High School (14+)": "lessonForm.levelHigh",
    "Adult": "lessonForm.levelAdult",
};

// Maps English tone values to i18n keys
const TONE_KEYS: Record<string, string> = {
    "Fun & Engaging": "lessonForm.toneFun",
    "Serious & Academic": "lessonForm.toneSerious",
    "Simple & Clear": "lessonForm.toneSimple",
    "Storytelling": "lessonForm.toneStorytelling",
};

// Maps duration values to i18n keys (reuse storyForm keys)
const DURATION_LABEL_KEYS: Record<number, string> = {
    7: "storyForm.duration7",
    10: "storyForm.duration10",
    15: "storyForm.duration15",
    0: "storyForm.durationCustom",
};

interface LessonGeneratorFormProps {
    onGenerate: (formData: LessonFormData) => void;
}

export function LessonGeneratorForm({ onGenerate }: LessonGeneratorFormProps) {
    const { t, isRTL } = useLanguage();
    const { user } = useApp();
    const [topic, setTopic] = useState("");
    const [level, setLevel] = useState(LESSON_LEVELS[1]); // Default to Elementary
    const [tone, setTone] = useState(LESSON_TONES[0]); // Default to Fun & Engaging
    const [additionalInfo, setAdditionalInfo] = useState("");
    const [durationOption, setDurationOption] = useState("10");
    const [customDuration, setCustomDuration] = useState("");
    const [language, setLanguageState] = useState(
        () => localStorage.getItem(LESSON_LANG_KEY) || "en"
    );
    const setLanguage = (lang: string) => {
        setLanguageState(lang);
        localStorage.setItem(LESSON_LANG_KEY, lang);
    };
    const [visibility, setVisibility] = useState<Visibility>("public");
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleVisibilityChange = (value: Visibility) => {
        if (value === "private" && !user) {
            setShowLoginModal(true);
            return;
        }
        setVisibility(value);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const duration =
            durationOption === "0"
                ? parseInt(customDuration) || 5
                : parseInt(durationOption);

        const formData: LessonFormData = {
            topic,
            level,
            tone,
            additionalInfo,
            duration,
            language,
            visibility,
        };

        onGenerate(formData);
    };

    return (
        <Card className="border-blue-200 shadow-lg relative overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
            {/* Decorative corner elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100 to-transparent rounded-bl-full opacity-50" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-green-100 to-transparent rounded-tr-full opacity-50" />

            <CardHeader className="bg-gradient-to-r from-blue-50 via-green-50 to-teal-50 relative z-10">
                <CardTitle className="flex items-center gap-2">
                    <BookOpen className="size-5 text-blue-600" />
                    {t("lessonForm.title")}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 relative z-10">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Language Selection */}
                    <div className="space-y-2">
                        <Label>{t("lessonForm.lessonLanguage")}</Label>
                        <Select value={language} onValueChange={setLanguage}>
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

                    {/* Topic */}
                    <div className="space-y-2">
                        <Label htmlFor="topic">{t("lessonForm.topic")}</Label>
                        <Input
                            id="topic"
                            required
                            value={topic}
                            onChange={(e) => setTopic(e.target.value)}
                            placeholder={t("lessonForm.topicPlaceholder")}
                        />
                    </div>

                    {/* Level & Tone */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>{t("lessonForm.level")}</Label>
                            <Select value={level} onValueChange={setLevel}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LESSON_LEVELS.map((l) => (
                                        <SelectItem key={l} value={l}>
                                            {t(LEVEL_KEYS[l] || l)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>{t("lessonForm.tone")}</Label>
                            <Select value={tone} onValueChange={setTone}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {LESSON_TONES.map((tn) => (
                                        <SelectItem key={tn} value={tn}>
                                            {t(TONE_KEYS[tn] || tn)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-2">
                        <Label htmlFor="additionalInfo">{t("lessonForm.specificFocus")}</Label>
                        <Textarea
                            id="additionalInfo"
                            value={additionalInfo}
                            onChange={(e) => setAdditionalInfo(e.target.value)}
                            placeholder={t("lessonForm.specificFocusPlaceholder")}
                            rows={3}
                        />
                    </div>

                    {/* Duration */}
                    <div className="space-y-2">
                        <Label>{t("lessonForm.duration")}</Label>
                        <Select value={durationOption} onValueChange={setDurationOption}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {DURATION_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value.toString()}>
                                        {t(DURATION_LABEL_KEYS[option.value] || option.label)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {durationOption === "0" && (
                            <div className="mt-2">
                                <Input
                                    type="number"
                                    min="1"
                                    max="30"
                                    value={customDuration}
                                    onChange={(e) => setCustomDuration(e.target.value)}
                                    placeholder={t("lessonForm.enterMinutes")}
                                />
                            </div>
                        )}
                    </div>

                    {/* Submit Button */}
                    <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
                        size="lg"
                    >
                        <Sparkles className="size-5 me-2" />
                        {t("lessonForm.generateLesson")}
                    </Button>

                    {/* Visibility Selector */}
                    <div className="grid grid-cols-3 gap-2">
                        {([
                            { value: "public" as Visibility, icon: Globe, label: t("privateMode.publicLabel"), sub: t("privateMode.publicSub"), activeClasses: { border: "#d1d5db", bg: "#f9fafb", iconBg: "bg-gray-500 text-white", title: "text-gray-700", sub: "text-gray-400", radio: "border-gray-500 bg-gray-500" } },
                            { value: "unlisted" as Visibility, icon: Link2, label: t("privateMode.unlistedLabel"), sub: t("privateMode.unlistedSub"), activeClasses: { border: "#fbbf24", bg: "#fffbeb", iconBg: "bg-amber-500 text-white", title: "text-amber-700", sub: "text-amber-500", radio: "border-amber-500 bg-amber-500" } },
                            { value: "private" as Visibility, icon: Lock, label: t("privateMode.privateLabel"), sub: t("privateMode.privateSub"), activeClasses: { border: "#818cf8", bg: "#eef2ff", iconBg: "bg-indigo-600 text-white", title: "text-indigo-700", sub: "text-indigo-500", radio: "border-indigo-600 bg-indigo-600" } },
                        ]).map(({ value, icon: Icon, label, sub, activeClasses }) => {
                            const selected = visibility === value;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    onClick={() => handleVisibilityChange(value)}
                                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 transition-all duration-200 text-center ${selected ? "" : "border-gray-200 bg-gray-50 hover:bg-gray-100"}`}
                                    style={selected ? { borderColor: activeClasses.border, backgroundColor: activeClasses.bg } : undefined}
                                >
                                    <div className={`size-8 rounded-full flex items-center justify-center ${selected ? activeClasses.iconBg : "bg-white text-gray-400 border border-gray-200"}`}>
                                        <Icon className="size-4" />
                                    </div>
                                    <div>
                                        <p className={`text-sm font-semibold leading-none mb-0.5 ${selected ? activeClasses.title : "text-gray-700"}`}>
                                            {label}
                                        </p>
                                        <p className={`text-xs ${selected ? activeClasses.sub : "text-gray-400"}`}>
                                            {sub}
                                        </p>
                                    </div>
                                    <div className={`size-4 rounded-full border-2 flex items-center justify-center transition-colors ${selected ? activeClasses.radio : "border-gray-300 bg-white"}`}>
                                        {selected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </form>
            </CardContent>

            <LoginRequiredModal
                open={showLoginModal}
                onClose={() => setShowLoginModal(false)}
                onLoginSuccess={() => setVisibility("private")}
            />
        </Card>
    );
}

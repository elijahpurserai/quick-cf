import { useState } from "react";
import { Globe, Link2, Lock, ChevronDown, Check, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { useLanguage } from "../contexts/LanguageContext";
import { Visibility } from "../types";
import { api } from "../services/api";
import { cn } from "./ui/utils";
import { toast } from "sonner";

interface VisibilityBadgeProps {
    visibility: Visibility;
    isOwner: boolean;
    creationId: string;
    onVisibilityChange?: (visibility: Visibility) => void;
}

const VISIBILITY_CONFIG = {
    public: {
        icon: Globe,
        badgeClass: "bg-green-50 text-green-700 border border-green-300",
        activeClass: "border-green-400 bg-green-50",
        iconBg: "bg-green-600 text-white",
        titleClass: "text-green-700",
        subClass: "text-green-500",
        radioClass: "border-green-600 bg-green-600",
    },
    unlisted: {
        icon: Link2,
        badgeClass: "bg-amber-50 text-amber-700 border border-amber-300",
        activeClass: "border-amber-400 bg-amber-50",
        iconBg: "bg-amber-500 text-white",
        titleClass: "text-amber-700",
        subClass: "text-amber-500",
        radioClass: "border-amber-500 bg-amber-500",
    },
    private: {
        icon: Lock,
        badgeClass: "bg-gray-100 text-gray-600 border border-gray-300",
        activeClass: "border-gray-400 bg-gray-100",
        iconBg: "bg-gray-600 text-white",
        titleClass: "text-gray-700",
        subClass: "text-gray-500",
        radioClass: "border-gray-600 bg-gray-600",
    },
};

export function VisibilityBadge({ visibility, isOwner, creationId, onVisibilityChange }: VisibilityBadgeProps) {
    const { t } = useLanguage();
    const [open, setOpen] = useState(false);
    const [updating, setUpdating] = useState(false);

    const config = VISIBILITY_CONFIG[visibility];
    const Icon = config.icon;

    const labelKey = visibility === "unlisted" ? "privateMode.unlistedBadge"
        : visibility === "private" ? "privateMode.badge"
        : "privateMode.publicLabel";

    const handleChange = async (newVisibility: Visibility) => {
        if (newVisibility === visibility || updating) return;

        setUpdating(true);
        try {
            await api.creations.updateVisibility(creationId, newVisibility);
            onVisibilityChange?.(newVisibility);
            setOpen(false);
        } catch {
            toast.error(t("privateMode.updateFailed"));
        } finally {
            setUpdating(false);
        }
    };

    // Non-owner: just show the badge (read-only)
    if (!isOwner) {
        return (
            <Badge className={cn("flex items-center gap-1", config.badgeClass)}>
                <Icon className="size-3" />
                {t(labelKey)}
            </Badge>
        );
    }

    // Owner: badge is a clickable popover trigger
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-all hover:opacity-80",
                        config.badgeClass
                    )}
                >
                    <Icon className="size-3" />
                    {t(labelKey)}
                    <ChevronDown className="size-3 opacity-60" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
                <div className="space-y-1">
                    {(["public", "unlisted", "private"] as Visibility[]).map((option) => {
                        const optConfig = VISIBILITY_CONFIG[option];
                        const OptIcon = optConfig.icon;
                        const selected = visibility === option;
                        const optLabel = option === "unlisted" ? "privateMode.unlistedLabel"
                            : option === "private" ? "privateMode.privateLabel"
                            : "privateMode.publicLabel";
                        const optSub = option === "unlisted" ? "privateMode.unlistedSub"
                            : option === "private" ? "privateMode.privateSub"
                            : "privateMode.publicSub";

                        return (
                            <button
                                key={option}
                                type="button"
                                onClick={() => handleChange(option)}
                                disabled={updating}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-start",
                                    selected
                                        ? optConfig.activeClass
                                        : "hover:bg-gray-50"
                                )}
                            >
                                <div className={cn(
                                    "size-7 rounded-full flex items-center justify-center flex-shrink-0",
                                    selected ? optConfig.iconBg : "bg-gray-100 text-gray-400"
                                )}>
                                    <OptIcon className="size-3.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className={cn("text-sm font-medium leading-none mb-0.5",
                                        selected ? optConfig.titleClass : "text-gray-700"
                                    )}>
                                        {t(optLabel)}
                                    </p>
                                    <p className={cn("text-xs",
                                        selected ? optConfig.subClass : "text-gray-400"
                                    )}>
                                        {t(optSub)}
                                    </p>
                                </div>
                                <div className={cn(
                                    "size-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors",
                                    selected ? optConfig.radioClass : "border-gray-300 bg-white"
                                )}>
                                    {selected && <Check className="size-2.5 text-white" strokeWidth={3} />}
                                    {updating && !selected && option === visibility && (
                                        <Loader2 className="size-2.5 animate-spin" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
}

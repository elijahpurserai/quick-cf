import { Shield, CheckCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { useLanguage } from "../contexts/LanguageContext";

export function SafetyBanner() {
  const { t } = useLanguage();
  return (
    <Alert className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 relative overflow-hidden">
      {/* Decorative sparkles */}
      <div className="absolute top-2 right-2 opacity-20">
        <Sparkles className="size-6 text-green-600" />
      </div>

      <Shield className="size-5 text-green-600" />
      <AlertTitle className="text-green-800">
        {t("safety.title")}
      </AlertTitle>
      <AlertDescription className="text-green-700 space-y-2">
        <p>{t("safety.description")}</p>
        <ul className="space-y-1 ml-4">
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 mt-0.5 flex-shrink-0" />
            <span>{t("safety.noScary")}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 mt-0.5 flex-shrink-0" />
            <span>{t("safety.noViolence")}</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="size-4 mt-0.5 flex-shrink-0" />
            <span>{t("safety.tagged")}</span>
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}
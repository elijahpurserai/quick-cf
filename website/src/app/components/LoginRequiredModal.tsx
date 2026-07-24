import { GoogleLogin } from "@react-oauth/google";
import { Lock } from "lucide-react";
import { useApp } from "../contexts/AppContext";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

interface LoginRequiredModalProps {
  open: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export function LoginRequiredModal({ open, onClose, onLoginSuccess }: LoginRequiredModalProps) {
  const { login } = useApp();
  const { t } = useLanguage();

  const handleLogin = async (credentialResponse: { credential?: string }) => {
    if (!credentialResponse.credential) return;
    await login(credentialResponse.credential);
    onLoginSuccess();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent className="sm:max-w-md text-center">
        <DialogHeader className="items-center">
          <div className="bg-purple-100 rounded-full p-3 mb-2">
            <Lock className="size-6 text-purple-600" />
          </div>
          <DialogTitle>{t("privateMode.loginRequired")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("privateMode.loginBenefit")}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center pt-2">
          <GoogleLogin
            onSuccess={handleLogin}
            onError={() => onClose()}
            useOneTap={false}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

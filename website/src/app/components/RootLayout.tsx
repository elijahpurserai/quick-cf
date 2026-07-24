import { Outlet } from "react-router";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { AppProvider } from "../contexts/AppContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { Toaster } from "./ui/sonner";
import { useEffect } from "react";
import { useLocation } from "react-router";
import { initGA, trackPageView } from "../utils/analytics";

import { GoogleOAuthProvider } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

export function RootLayout() {
  const location = useLocation();

  useEffect(() => {
    initGA();
  }, []);

  useEffect(() => {
    trackPageView(location.pathname + location.search);
    // Reset scroll to top on navigation
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <LanguageProvider>
        <AppProvider>
          <div className="min-h-screen bg-gradient-to-br from-purple-50/80 via-pink-50/80 to-blue-50/80 flex flex-col relative">
            {/* Subtle playful background pattern */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%239C92AC' fill-opacity='1' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/svg%3E")`,
              }}
            />

            <Header />
            <main className="flex-1 relative z-10">
              <Outlet />
            </main>
            <Footer />
            <Toaster />
          </div>
        </AppProvider>
      </LanguageProvider>
    </GoogleOAuthProvider>
  );
}
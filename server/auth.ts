import { Router, Request, Response, NextFunction } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import crypto from "crypto";
import { supabase } from "./supabase";
import { APPROVED_EMAILS } from "./config";

// Derive cookie domain from CLIENT_URL so cookies work across subdomains.
// e.g. "https://quickstory.ai" → ".quickstory.ai"
// In dev (localhost), leave undefined so cookies stay on the exact host.
const COOKIE_DOMAIN = (() => {
    try {
        const host = new URL(process.env.CLIENT_URL || "").hostname;
        // Don't set domain for localhost / IP addresses
        if (host === "localhost" || /^\d+\./.test(host)) return undefined;
        return `.${host}`;
    } catch {
        return undefined;
    }
})();

export const authRoutes = Router();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Generates a deterministic UUID from a string (e.g., Google sub).
 * This ensures the same user always gets the same UUID for Postgres.
 */
const generateUUID = (input: string) => {
    const hash = crypto.createHash("sha256").update(input).digest("hex");
    return [
        hash.substring(0, 8),
        hash.substring(8, 12),
        "4" + hash.substring(13, 16),
        "a" + hash.substring(17, 20),
        hash.substring(20, 32),
    ].join("-");
};

interface AuthRequest extends Request {
    user?: any;
}

// Middleware to verify JWT - optional version
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction) => {
    const token = req.cookies?.token;

    if (!token) {
        // Allow anonymous access - req.user will be undefined
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        // If token is invalid, we clear it and treat as anonymous/unauthorized
        res.clearCookie("token", { domain: COOKIE_DOMAIN });
        // We could either block it or allow as anonymous. 
        // Given the design, let's allow as anonymous but clear the bad cookie.
        next();
    }
};

authRoutes.post("/auth/google", async (req, res) => {
    const { credential } = req.body;

    if (!credential) {
        return res.status(400).json({ error: "Credential is required" });
    }

    try {
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        if (!payload) {
            throw new Error("Invalid token payload");
        }

        const user = {
            id: generateUUID(payload.sub),
            email: payload.email || "",
            name: payload.name || "",
            avatar: payload.picture || "",
        };

        // Upsert user into our profiles table
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                full_name: user.name,
                avatar_url: user.avatar,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

        if (upsertError) {
            console.error("[Auth] Profile upsert failed:", upsertError);
            // We continue anyway, but the user might have issues with constraints later
        }

        // Create JWT
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });

        // Set cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            domain: COOKIE_DOMAIN,
        });

        res.json({ user: { ...user, isAdmin: APPROVED_EMAILS.includes(user.email) } });
    } catch (error) {
        console.error("Google Auth error:", error);
        res.status(401).json({ error: "Authentication failed" });
    }
});

authRoutes.post("/auth/logout", (req, res) => {
    res.clearCookie("token", { domain: COOKIE_DOMAIN });
    res.json({ message: "Logged out successfully" });
});

authRoutes.get("/auth/me", authenticateJWT, (req: AuthRequest, res) => {
    const isAdmin = req.user ? APPROVED_EMAILS.includes(req.user.email) : false;
    res.json({ user: req.user ? { ...req.user, isAdmin } : null });
});

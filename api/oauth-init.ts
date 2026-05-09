import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createOAuthStateToken } from "./oauth-state";

const ALLOWED_PLATFORMS = new Set(["github", "xero", "reddit", "shopify"]);

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "https://unclick.world");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const { platform, store } = (req.body ?? {}) as {
    platform?: string;
    store?: string;
  };

  if (!platform || !ALLOWED_PLATFORMS.has(platform)) {
    return res.status(400).json({ error: "Unsupported OAuth platform." });
  }

  const normalizedStore =
    platform === "shopify" && typeof store === "string"
      ? store.trim().replace(/\.myshopify\.com$/i, "")
      : undefined;

  if (platform === "shopify" && !normalizedStore) {
    return res.status(400).json({ error: "store is required for Shopify." });
  }

  try {
    const state = createOAuthStateToken({
      platform,
      redirectPath: `/connect/${platform}`,
      env: process.env,
      ...(normalizedStore ? { store: normalizedStore } : {}),
    });

    return res.status(200).json({ success: true, state });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initialize OAuth.";
    return res.status(500).json({ error: message });
  }
}

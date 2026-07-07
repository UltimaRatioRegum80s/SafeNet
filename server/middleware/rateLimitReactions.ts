import rateLimit from "express-rate-limit";

export const limitReactions = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // 20 reaction writes per 5 mins per user
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // Use authenticated user ID for rate limiting, no IP fallback needed
    // since reactions require authentication (requireAuth middleware runs first)
    return req.authUserId || 'anonymous';
  },
  message: { error: "Too many reactions. Try again in a few minutes." },
  // Skip IP validation since we use authUserId from session
  validate: { xForwardedForHeader: false },
});

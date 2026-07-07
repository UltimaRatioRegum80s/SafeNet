import rateLimit from "express-rate-limit";

export const limitUploads = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20, // 20 upload requests per 5 mins
  standardHeaders: true,
  legacyHeaders: false,
});
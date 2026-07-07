import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const APP_URL = process.env.APP_URL || `http://localhost:${process.env.PORT || 5000}`;

export function setupOAuth() {
  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      done(null, user || null);
    } catch (err) {
      done(err, null);
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${APP_URL}/api/auth/google/callback`,
          scope: ["profile", "email"],
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value?.toLowerCase().trim();
            if (!email) {
              return done(null, false, { message: "No email returned from Google" });
            }

            const existing = await db
              .select()
              .from(users)
              .where(eq(sql`lower(${users.email})`, email))
              .limit(1);

            if (existing.length > 0) {
              const user = existing[0];
              if (!user.oauthProvider) {
                await db
                  .update(users)
                  .set({
                    oauthProvider: "google",
                    oauthProviderId: profile.id,
                    emailVerified: true,
                  })
                  .where(eq(users.id, user.id));
              }
              return done(null, user);
            }

            const displayName =
              profile.displayName || `${profile.name?.givenName || ""} ${profile.name?.familyName || ""}`.trim() || email.split("@")[0];

            const [newUser] = await db
              .insert(users)
              .values({
                email,
                username: displayName,
                oauthProvider: "google",
                oauthProviderId: profile.id,
                emailVerified: true,
                accessStatus: "pending",
                accessRequestedAt: new Date(),
                requestedName: displayName,
                roles: ["resident"],
                country: "",
                city: "",
              })
              .returning();

            console.log(`🔐 [OAUTH] New Google user created: ${email} (pending approval)`);
            return done(null, newUser);
          } catch (err) {
            console.error("Google OAuth error:", err);
            return done(err as Error, undefined);
          }
        }
      )
    );
    console.log("✅ [OAUTH] Google strategy configured");
  } else {
    console.log("⚠️ [OAUTH] Google OAuth not configured (missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
  }
}

export function setupOAuthRoutes(app: any) {
  if (!process.env.GOOGLE_CLIENT_ID) return;

  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/login?error=oauth_failed", session: false }),
    (req: any, res: any) => {
      if (!req.user) {
        return res.redirect("/login?error=oauth_failed");
      }
      
      // Session fixation mitigation: regenerate session ID before storing user
      const user = req.user;
      req.session.regenerate((regenErr: any) => {
        if (regenErr) {
          console.error("Session regeneration failed after OAuth:", regenErr);
          return res.redirect("/login?error=session_failed");
        }
        
        (req.session as any).userId = user.id;
        req.session.save((err: any) => {
          if (err) {
            console.error("Session save error after OAuth:", err);
            return res.redirect("/login?error=session_failed");
          }
          const status = user.accessStatus;
          if (status === "approved") {
            res.redirect("/community/dashboard");
          } else if (status === "denied") {
            res.redirect("/access-denied");
          } else {
            res.redirect("/pending");
          }
        });
      });
    }
  );
}

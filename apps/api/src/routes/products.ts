import { PRODUCT_CATALOG, type ProductAccess } from "@tikgames/shared-types";
import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

const router = Router();

/** Same rule auth.ts applies when it builds the public user: a TRIAL whose window has passed is
 *  already EXPIRED, whatever the stored column still says. Duplicated deliberately rather than
 *  exported across routers — it's two lines, and coupling the two files for it would be worse. */
function isSubscriptionUsable(status: string, trialEndsAt: Date): boolean {
  if (status === "TRIAL") return trialEndsAt.getTime() >= Date.now();
  return status === "ACTIVE";
}

// Public catalog — the marketing site renders this without anyone being signed in. Access flags
// are deliberately absent here; "what exists" is public, "what you can open" is not.
router.get("/", (_req, res) => {
  res.json({ products: PRODUCT_CATALOG });
});

/**
 * The signed-in creator's view of the catalog. `unlocked` is decided here, never in the client —
 * the dashboard uses it to grey out a card, but every product's own routes still enforce access
 * themselves (a locked card that someone URL-hops past must still hit a real 403 downstream).
 */
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const subscription = await prisma.subscription.findUnique({ where: { userId: req.userId! } });
    const subscriptionOk = subscription
      ? isSubscriptionUsable(subscription.status, subscription.trialEndsAt)
      : false;

    const products: ProductAccess[] = PRODUCT_CATALOG.map((product) => {
      if (product.status === "COMING_SOON") {
        return { ...product, unlocked: false, lockedReasonAr: "لسه بيتبني — قريباً" };
      }
      if (!subscriptionOk) {
        return { ...product, unlocked: false, lockedReasonAr: "محتاج اشتراك فعّال" };
      }
      return { ...product, unlocked: true, lockedReasonAr: null };
    });

    res.json({ products });
  }),
);

export default router;

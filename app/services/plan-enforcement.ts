import type { PlanId, PlanFeatures } from "./billing-types";
import { PLANS } from "./billing-types";

/**
 * Plan enforcement — checks plan limits before allowing actions.
 * Designed as pure functions so they can be used in route loaders,
 * actions, API middleware, or anywhere else.
 */

export interface PlanContext {
  plan: PlanId;
  currentZoneCount: number;
}

export interface EnforcementResult {
  allowed: boolean;
  reason?: string;
  upgradeRequired?: boolean;
}

/** Check if the shop can create a new shipping zone */
export function canCreateZone(ctx: PlanContext): EnforcementResult {
  const features = getPlanFeatures(ctx.plan);
  if (ctx.currentZoneCount >= features.maxShippingZones) {
    return {
      allowed: false,
      reason: `${PLANS[ctx.plan].name} plan allows ${features.maxShippingZones === Infinity ? "unlimited" : features.maxShippingZones} shipping zone${features.maxShippingZones === 1 ? "" : "s"}. Upgrade to Pro for unlimited zones.`,
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/** Check if custom styling is available */
export function canUseCustomStyling(plan: PlanId): EnforcementResult {
  const features = getPlanFeatures(plan);
  if (!features.customStyling) {
    return {
      allowed: false,
      reason: "Custom styling is available on the Pro plan.",
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/** Check if branding can be removed */
export function canRemoveBranding(plan: PlanId): EnforcementResult {
  const features = getPlanFeatures(plan);
  if (!features.removeBranding) {
    return {
      allowed: false,
      reason: "Removing branding is available on the Pro plan.",
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/** Check if analytics dashboard is accessible */
export function canAccessAnalytics(plan: PlanId): EnforcementResult {
  const features = getPlanFeatures(plan);
  if (!features.analyticsAccess) {
    return {
      allowed: false,
      reason: "Analytics are available on the Pro plan.",
      upgradeRequired: true,
    };
  }
  return { allowed: true };
}

/** Get features for a plan, defaulting to free if unknown */
export function getPlanFeatures(plan: PlanId): PlanFeatures {
  return PLANS[plan]?.features ?? PLANS.free.features;
}

/** Check if a plan is a paid plan */
export function isPaidPlan(plan: PlanId): boolean {
  return PLANS[plan]?.price > 0;
}

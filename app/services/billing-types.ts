/** Billing plan identifiers */
export type PlanId = "free" | "pro";

/** Feature flags gated by plan */
export interface PlanFeatures {
  maxShippingZones: number;
  customStyling: boolean;
  removeBranding: boolean;
  analyticsAccess: boolean;
}

/** Plan definition with pricing and features */
export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number; // monthly price in USD
  trialDays: number;
  features: PlanFeatures;
}

/** Active subscription state for a shop */
export interface ShopSubscription {
  shopId: string;
  plan: PlanId;
  shopifySubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null; // ISO date
  trialEndsAt: string | null; // ISO date
}

export type SubscriptionStatus =
  | "active"
  | "pending"
  | "cancelled"
  | "expired"
  | "declined";

/** Result of creating a subscription via Shopify Billing API */
export interface CreateSubscriptionResult {
  confirmationUrl: string;
  subscriptionId: string;
}

/** Webhook payload for APP_SUBSCRIPTIONS_UPDATE */
export interface SubscriptionUpdatePayload {
  app_subscription: {
    admin_graphql_api_id: string;
    name: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
}

/** Plan definitions — single source of truth */
export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    trialDays: 0,
    features: {
      maxShippingZones: 1,
      customStyling: false,
      removeBranding: false,
      analyticsAccess: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 9.99,
    trialDays: 7,
    features: {
      maxShippingZones: Infinity,
      customStyling: true,
      removeBranding: true,
      analyticsAccess: true,
    },
  },
};

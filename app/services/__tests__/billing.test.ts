import { describe, it, expect, beforeEach } from "vitest";
import { BillingService, BillingError } from "../billing";
import type { GraphQLClient, ShopStore } from "../billing";
import type { ShopSubscription } from "../billing-types";

/** In-memory mock store for testing */
function createMockStore(
  initial?: Partial<ShopSubscription>,
  zoneCount = 0
): ShopStore {
  const subscriptions = new Map<string, ShopSubscription>();
  if (initial) {
    subscriptions.set(initial.shopId ?? "shop-1", {
      shopId: "shop-1",
      plan: "free",
      shopifySubscriptionId: null,
      status: "active",
      currentPeriodEnd: null,
      trialEndsAt: null,
      ...initial,
    });
  }

  return {
    async getSubscription(shopId: string) {
      return subscriptions.get(shopId) ?? null;
    },
    async updateSubscription(shopId: string, update: Partial<ShopSubscription>) {
      const existing = subscriptions.get(shopId) ?? {
        shopId,
        plan: "free" as const,
        shopifySubscriptionId: null,
        status: "active" as const,
        currentPeriodEnd: null,
        trialEndsAt: null,
      };
      subscriptions.set(shopId, { ...existing, ...update });
    },
    async getShippingZoneCount() {
      return zoneCount;
    },
  };
}

/** Mock GraphQL client */
function createMockGraphQL(
  response?: Record<string, unknown>
): GraphQLClient & { lastQuery: string | null; lastVars: Record<string, unknown> | null } {
  const defaultResponse = {
    appSubscriptionCreate: {
      appSubscription: { id: "gid://shopify/AppSubscription/123" },
      confirmationUrl: "https://admin.shopify.com/confirm",
      userErrors: [],
    },
  };
  const client = {
    lastQuery: null as string | null,
    lastVars: null as Record<string, unknown> | null,
    async query<T = unknown>(query: string, variables?: Record<string, unknown>): Promise<{ data: T; errors?: Array<{ message: string }> }> {
      client.lastQuery = query;
      client.lastVars = variables ?? null;
      return { data: (response ?? defaultResponse) as T };
    },
  };
  return client;
}

describe("BillingService", () => {
  const shopId = "shop-1";
  const returnUrl = "https://myapp.com/billing/callback";

  describe("getCurrentPlan", () => {
    it("returns free when no subscription exists", async () => {
      const store = createMockStore();
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.getCurrentPlan(shopId)).toBe("free");
    });

    it("returns free when subscription is not active", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "cancelled",
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.getCurrentPlan(shopId)).toBe("free");
    });

    it("returns pro when subscription is active", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "active",
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.getCurrentPlan(shopId)).toBe("pro");
    });
  });

  describe("getFeatures", () => {
    it("returns free features by default", async () => {
      const store = createMockStore();
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      const features = await billing.getFeatures(shopId);
      expect(features.maxShippingZones).toBe(1);
      expect(features.customStyling).toBe(false);
      expect(features.removeBranding).toBe(false);
    });

    it("returns pro features for active pro subscription", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "active",
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      const features = await billing.getFeatures(shopId);
      expect(features.maxShippingZones).toBe(Infinity);
      expect(features.customStyling).toBe(true);
      expect(features.removeBranding).toBe(true);
    });
  });

  describe("createProSubscription", () => {
    it("calls Shopify GraphQL with correct variables", async () => {
      const store = createMockStore();
      const graphql = createMockGraphQL();
      const billing = new BillingService(graphql, store, returnUrl, true);

      await billing.createProSubscription(shopId);

      expect(graphql.lastVars).toEqual({
        name: "Pro",
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: 9.99, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
        returnUrl,
        trialDays: 7,
        test: true,
      });
    });

    it("returns confirmation URL and subscription ID", async () => {
      const store = createMockStore();
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      const result = await billing.createProSubscription(shopId);

      expect(result.confirmationUrl).toBe(
        "https://admin.shopify.com/confirm"
      );
      expect(result.subscriptionId).toBe(
        "gid://shopify/AppSubscription/123"
      );
    });

    it("sets subscription to pending status", async () => {
      const store = createMockStore();
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await billing.createProSubscription(shopId);

      const sub = await store.getSubscription(shopId);
      expect(sub?.plan).toBe("pro");
      expect(sub?.status).toBe("pending");
      expect(sub?.shopifySubscriptionId).toBe(
        "gid://shopify/AppSubscription/123"
      );
    });

    it("throws BillingError on Shopify user errors", async () => {
      const graphql = createMockGraphQL({
        appSubscriptionCreate: {
          appSubscription: null,
          confirmationUrl: null,
          userErrors: [
            { field: ["name"], message: "Plan name already exists" },
          ],
        },
      });
      const billing = new BillingService(graphql, createMockStore(), returnUrl);

      await expect(billing.createProSubscription(shopId)).rejects.toThrow(
        BillingError
      );
    });

    it("throws BillingError when confirmation URL is missing", async () => {
      const graphql = createMockGraphQL({
        appSubscriptionCreate: {
          appSubscription: null,
          confirmationUrl: null,
          userErrors: [],
        },
      });
      const billing = new BillingService(graphql, createMockStore(), returnUrl);

      await expect(billing.createProSubscription(shopId)).rejects.toThrow(
        "Missing confirmation URL"
      );
    });
  });

  describe("handleSubscriptionUpdate", () => {
    const subId = "gid://shopify/AppSubscription/123";

    it("activates a pending subscription", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "pending",
        shopifySubscriptionId: subId,
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await billing.handleSubscriptionUpdate(shopId, subId, "ACTIVE");

      const sub = await store.getSubscription(shopId);
      expect(sub?.status).toBe("active");
      expect(sub?.plan).toBe("pro");
    });

    it("downgrades to free on cancellation", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "active",
        shopifySubscriptionId: subId,
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await billing.handleSubscriptionUpdate(shopId, subId, "CANCELLED");

      const sub = await store.getSubscription(shopId);
      expect(sub?.plan).toBe("free");
      expect(sub?.status).toBe("cancelled");
    });

    it("downgrades to free on expiration", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "active",
        shopifySubscriptionId: subId,
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await billing.handleSubscriptionUpdate(shopId, subId, "EXPIRED");

      const sub = await store.getSubscription(shopId);
      expect(sub?.plan).toBe("free");
    });

    it("downgrades to free on decline", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "pending",
        shopifySubscriptionId: subId,
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await billing.handleSubscriptionUpdate(shopId, subId, "DECLINED");

      const sub = await store.getSubscription(shopId);
      expect(sub?.plan).toBe("free");
      expect(sub?.status).toBe("declined");
    });

    it("throws on unknown status", async () => {
      const store = createMockStore({
        shopId,
        shopifySubscriptionId: subId,
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await expect(
        billing.handleSubscriptionUpdate(shopId, subId, "UNKNOWN_STATUS")
      ).rejects.toThrow("Unknown subscription status");
    });

    it("throws when subscription ID does not match", async () => {
      const store = createMockStore({
        shopId,
        shopifySubscriptionId: "gid://shopify/AppSubscription/999",
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);

      await expect(
        billing.handleSubscriptionUpdate(shopId, subId, "ACTIVE")
      ).rejects.toThrow("not found");
    });
  });

  describe("canCreateZone", () => {
    it("allows zone creation on free plan when under limit", async () => {
      const store = createMockStore(undefined, 0);
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.canCreateZone(shopId)).toBe(true);
    });

    it("blocks zone creation on free plan when at limit", async () => {
      const store = createMockStore(undefined, 1);
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.canCreateZone(shopId)).toBe(false);
    });

    it("allows zone creation on pro plan with many zones", async () => {
      const store = createMockStore(
        { shopId, plan: "pro", status: "active" },
        100
      );
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.canCreateZone(shopId)).toBe(true);
    });
  });

  describe("hasFeature", () => {
    it("free plan does not have customStyling", async () => {
      const store = createMockStore();
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.hasFeature(shopId, "customStyling")).toBe(false);
    });

    it("pro plan has customStyling", async () => {
      const store = createMockStore({
        shopId,
        plan: "pro",
        status: "active",
      });
      const billing = new BillingService(createMockGraphQL(), store, returnUrl);
      expect(await billing.hasFeature(shopId, "customStyling")).toBe(true);
    });
  });
});

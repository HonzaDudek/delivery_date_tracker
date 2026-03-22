import type {
  PlanId,
  PlanFeatures,
  ShopSubscription,
  CreateSubscriptionResult,
  SubscriptionStatus,
} from "./billing-types";
import { PLANS } from "./billing-types";

/**
 * GraphQL client interface — the actual Shopify authenticated client
 * will be injected from the Remix app scaffold. This abstraction lets
 * us test billing logic without a real Shopify connection.
 */
export interface GraphQLClient {
  query<T = unknown>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<{ data: T; errors?: Array<{ message: string }> }>;
}

/**
 * Shop data store interface — abstracts Prisma calls so billing
 * logic is testable without a database.
 */
export interface ShopStore {
  getSubscription(shopId: string): Promise<ShopSubscription | null>;
  updateSubscription(
    shopId: string,
    update: Partial<ShopSubscription>
  ): Promise<void>;
  getShippingZoneCount(shopId: string): Promise<number>;
}

const APP_SUBSCRIPTION_CREATE = `
  mutation appSubscriptionCreate(
    $name: String!
    $lineItems: [AppSubscriptionLineItemInput!]!
    $returnUrl: URL!
    $trialDays: Int
    $test: Boolean
  ) {
    appSubscriptionCreate(
      name: $name
      lineItems: $lineItems
      returnUrl: $returnUrl
      trialDays: $trialDays
      test: $test
    ) {
      appSubscription {
        id
      }
      confirmationUrl
      userErrors {
        field
        message
      }
    }
  }
`;

interface AppSubscriptionCreateResponse {
  appSubscriptionCreate: {
    appSubscription: { id: string } | null;
    confirmationUrl: string | null;
    userErrors: Array<{ field: string[]; message: string }>;
  };
}

/**
 * Billing service — manages Shopify subscription lifecycle.
 */
export class BillingService {
  constructor(
    private graphql: GraphQLClient,
    private store: ShopStore,
    private returnUrl: string,
    private isTest: boolean = false
  ) {}

  /** Get the current plan for a shop, defaulting to free */
  async getCurrentPlan(shopId: string): Promise<PlanId> {
    const sub = await this.store.getSubscription(shopId);
    if (!sub || sub.status !== "active") return "free";
    return sub.plan;
  }

  /** Get the feature set for a shop's current plan */
  async getFeatures(shopId: string): Promise<PlanFeatures> {
    const plan = await this.getCurrentPlan(shopId);
    return PLANS[plan].features;
  }

  /** Create a Shopify subscription for upgrading to Pro */
  async createProSubscription(
    shopId: string
  ): Promise<CreateSubscriptionResult> {
    const plan = PLANS.pro;

    const result = await this.graphql.query<AppSubscriptionCreateResponse>(
      APP_SUBSCRIPTION_CREATE,
      {
        name: plan.name,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: plan.price, currencyCode: "USD" },
                interval: "EVERY_30_DAYS",
              },
            },
          },
        ],
        returnUrl: this.returnUrl,
        trialDays: plan.trialDays,
        test: this.isTest,
      }
    );

    const data = result.data.appSubscriptionCreate;
    if (data.userErrors.length > 0) {
      throw new BillingError(
        `Failed to create subscription: ${data.userErrors.map((e) => e.message).join(", ")}`,
        data.userErrors
      );
    }

    if (!data.confirmationUrl || !data.appSubscription) {
      throw new BillingError("Missing confirmation URL or subscription ID");
    }

    // Mark subscription as pending until Shopify confirms via webhook
    await this.store.updateSubscription(shopId, {
      plan: "pro",
      shopifySubscriptionId: data.appSubscription.id,
      status: "pending",
    });

    return {
      confirmationUrl: data.confirmationUrl,
      subscriptionId: data.appSubscription.id,
    };
  }

  /** Handle APP_SUBSCRIPTIONS_UPDATE webhook */
  async handleSubscriptionUpdate(
    shopId: string,
    shopifySubscriptionId: string,
    newStatus: string
  ): Promise<void> {
    const statusMap: Record<string, SubscriptionStatus> = {
      ACTIVE: "active",
      PENDING: "pending",
      CANCELLED: "cancelled",
      EXPIRED: "expired",
      DECLINED: "declined",
    };

    const status = statusMap[newStatus.toUpperCase()];
    if (!status) {
      throw new BillingError(`Unknown subscription status: ${newStatus}`);
    }

    const sub = await this.store.getSubscription(shopId);
    if (!sub || sub.shopifySubscriptionId !== shopifySubscriptionId) {
      throw new BillingError(
        `Subscription ${shopifySubscriptionId} not found for shop ${shopId}`
      );
    }

    await this.store.updateSubscription(shopId, { status });

    // If cancelled/expired/declined, downgrade to free
    if (status === "cancelled" || status === "expired" || status === "declined") {
      await this.store.updateSubscription(shopId, {
        plan: "free",
        status,
      });
    }
  }

  /** Check if shop can create another shipping zone under current plan */
  async canCreateZone(shopId: string): Promise<boolean> {
    const features = await this.getFeatures(shopId);
    const zoneCount = await this.store.getShippingZoneCount(shopId);
    return zoneCount < features.maxShippingZones;
  }

  /** Check if a specific feature is available on the shop's plan */
  async hasFeature(
    shopId: string,
    feature: keyof PlanFeatures
  ): Promise<boolean> {
    const features = await this.getFeatures(shopId);
    return !!features[feature];
  }
}

/** Billing-specific error with optional Shopify user errors */
export class BillingError extends Error {
  constructor(
    message: string,
    public userErrors?: Array<{ field: string[]; message: string }>
  ) {
    super(message);
    this.name = "BillingError";
  }
}

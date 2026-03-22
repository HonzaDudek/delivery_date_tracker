import type { SubscriptionUpdatePayload } from "./billing-types";
import type { BillingService } from "./billing";

/**
 * Handler for the APP_SUBSCRIPTIONS_UPDATE Shopify webhook.
 *
 * In the Remix app, this will be wired to a webhook route like:
 *   app/routes/webhooks.app-subscriptions-update.ts
 *
 * The route will verify the HMAC, parse the payload, look up
 * the shop from the webhook context, and call this handler.
 */
export async function handleSubscriptionWebhook(
  billing: BillingService,
  shopId: string,
  payload: SubscriptionUpdatePayload
): Promise<{ action: string; status: string }> {
  const sub = payload.app_subscription;

  // Extract the GID (e.g., "gid://shopify/AppSubscription/12345")
  const shopifySubscriptionId = sub.admin_graphql_api_id;
  const newStatus = sub.status;

  await billing.handleSubscriptionUpdate(shopId, shopifySubscriptionId, newStatus);

  return {
    action: "subscription_updated",
    status: newStatus,
  };
}

/**
 * Validate that a webhook payload has the expected shape.
 * Returns null if valid, or an error message if invalid.
 */
export function validateSubscriptionPayload(
  payload: unknown
): payload is SubscriptionUpdatePayload {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as Record<string, unknown>;
  if (!p.app_subscription || typeof p.app_subscription !== "object")
    return false;
  const sub = p.app_subscription as Record<string, unknown>;
  return (
    typeof sub.admin_graphql_api_id === "string" &&
    typeof sub.status === "string"
  );
}

import { describe, it, expect } from "vitest";
import { validateSubscriptionPayload } from "../subscription-webhook";

describe("Subscription Webhook", () => {
  describe("validateSubscriptionPayload", () => {
    it("validates a correct payload", () => {
      const payload = {
        app_subscription: {
          admin_graphql_api_id: "gid://shopify/AppSubscription/123",
          name: "Pro",
          status: "ACTIVE",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-03-21T00:00:00Z",
        },
      };
      expect(validateSubscriptionPayload(payload)).toBe(true);
    });

    it("rejects null", () => {
      expect(validateSubscriptionPayload(null)).toBe(false);
    });

    it("rejects undefined", () => {
      expect(validateSubscriptionPayload(undefined)).toBe(false);
    });

    it("rejects empty object", () => {
      expect(validateSubscriptionPayload({})).toBe(false);
    });

    it("rejects missing admin_graphql_api_id", () => {
      const payload = {
        app_subscription: {
          name: "Pro",
          status: "ACTIVE",
        },
      };
      expect(validateSubscriptionPayload(payload)).toBe(false);
    });

    it("rejects missing status", () => {
      const payload = {
        app_subscription: {
          admin_graphql_api_id: "gid://shopify/AppSubscription/123",
          name: "Pro",
        },
      };
      expect(validateSubscriptionPayload(payload)).toBe(false);
    });

    it("rejects non-string status", () => {
      const payload = {
        app_subscription: {
          admin_graphql_api_id: "gid://shopify/AppSubscription/123",
          status: 123,
        },
      };
      expect(validateSubscriptionPayload(payload)).toBe(false);
    });

    it("rejects non-object app_subscription", () => {
      const payload = {
        app_subscription: "not-an-object",
      };
      expect(validateSubscriptionPayload(payload)).toBe(false);
    });
  });
});

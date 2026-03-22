import type { ShopSubscription } from "./billing-types";
import type { ShopStore } from "./billing";
import prisma from "../db.server";

/**
 * Prisma-backed implementation of ShopStore for the billing service.
 * Maps the Shop model's plan/subscription fields to the billing interface.
 */
export const prismaShopStore: ShopStore = {
  async getSubscription(shopId: string): Promise<ShopSubscription | null> {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });
    if (!shop) return null;

    return {
      shopId: shop.id,
      plan: shop.plan as ShopSubscription["plan"],
      shopifySubscriptionId: shop.subscriptionId,
      status: (shop.subscriptionStatus as ShopSubscription["status"]) ?? "active",
      currentPeriodEnd: null,
      trialEndsAt: null,
    };
  },

  async updateSubscription(
    shopId: string,
    update: Partial<ShopSubscription>
  ): Promise<void> {
    const data: Record<string, unknown> = {};
    if (update.plan !== undefined) data.plan = update.plan;
    if (update.shopifySubscriptionId !== undefined)
      data.subscriptionId = update.shopifySubscriptionId;
    if (update.status !== undefined) data.subscriptionStatus = update.status;

    await prisma.shop.update({
      where: { id: shopId },
      data,
    });
  },

  async getShippingZoneCount(shopId: string): Promise<number> {
    return prisma.shippingZone.count({
      where: { shopId },
    });
  },
};

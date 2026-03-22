import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, admin } =
    await authenticate.webhook(request);

  if (!admin) {
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      // Clean up shop data on uninstall
      await prisma.shop
        .findUnique({ where: { shopifyDomain: shop } })
        .then(async (shopRecord) => {
          if (shopRecord) {
            await prisma.estimateLog.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.excludedDate.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.shippingZone.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.shop.delete({ where: { id: shopRecord.id } });
          }
        })
        .catch((err) => {
          console.error(`Failed to clean up shop data for ${shop}:`, err);
        });
      break;

    case "CUSTOMERS_DATA_REQUEST":
      // GDPR: Customer data request
      // This app does not store any personally identifiable customer data.
      // EstimateLog records contain only shopId, productId, zone name, and
      // the computed estimate — no customer identifiers, emails, or addresses.
      console.log(`GDPR data request received for shop ${shop}. No customer PII stored.`);
      break;

    case "CUSTOMERS_REDACT":
      // GDPR: Customer data erasure request
      // No customer PII is stored by this app, so no data needs to be deleted.
      console.log(`GDPR customer redact received for shop ${shop}. No customer PII to delete.`);
      break;

    case "SHOP_REDACT":
      // GDPR: Shop data erasure — 48 hours after app uninstall
      // Delete any remaining shop data that may not have been cleaned on APP_UNINSTALLED
      console.log(`GDPR shop redact received for shop ${shop}. Cleaning remaining data.`);
      await prisma.shop
        .findUnique({ where: { shopifyDomain: shop } })
        .then(async (shopRecord) => {
          if (shopRecord) {
            await prisma.estimateLog.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.excludedDate.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.shippingZone.deleteMany({ where: { shopId: shopRecord.id } });
            await prisma.shop.delete({ where: { id: shopRecord.id } });
          }
        })
        .catch((err) => {
          console.error(`Failed GDPR shop redact for ${shop}:`, err);
        });
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};

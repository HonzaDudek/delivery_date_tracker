import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import prisma from "../db.server";
import { calculateDeliveryEstimate } from "../services/delivery-calculator";
import { checkRateLimit } from "../utils/rate-limiter";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const countryCode = url.searchParams.get("country") || "US";
  const productId = url.searchParams.get("productId");
  if (!shopDomain) {
    return json({ error: "Missing shop parameter" }, { status: 400 });
  }

  // Rate limit: 60 requests per minute per shop
  const rateLimit = checkRateLimit(`estimate:${shopDomain}`);
  if (!rateLimit.allowed) {
    return json(
      { error: "Rate limit exceeded. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: shopDomain },
    include: {
      shippingZones: true,
      excludedDates: true,
    },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  const zone = shop.shippingZones.find((z) =>
    z.countries.split(",").map((c) => c.trim()).includes(countryCode)
  );

  if (!zone) {
    return json({ error: "No shipping zone for this region" }, { status: 404 });
  }

  const estimate = calculateDeliveryEstimate({
    processingDays: shop.processingDays,
    cutoffTime: shop.cutoffTime,
    timezone: shop.timezone,
    skipWeekends: shop.skipWeekends,
    transitDaysMin: zone.transitDaysMin,
    transitDaysMax: zone.transitDaysMax,
    carrier: zone.carrier,
    excludedDates: shop.excludedDates.map((d) => ({
      date: d.date,
      recurring: d.recurring,
    })),
  });

  // Log the estimate for analytics (fire-and-forget)
  prisma.estimateLog
    .create({
      data: {
        shopId: shop.id,
        productId: productId || null,
        zone: zone.name,
        estimate: JSON.stringify(estimate),
      },
    })
    .catch(() => {});

  return json(estimate, {
    headers: {
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    },
  });
};

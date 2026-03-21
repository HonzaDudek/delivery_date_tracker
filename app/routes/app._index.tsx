import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Banner,
  List,
  InlineStack,
  Badge,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: {
      shippingZones: true,
      excludedDates: true,
    },
  });

  const estimateCount = shop
    ? await prisma.estimateLog.count({ where: { shopId: shop.id } })
    : 0;

  const recentEstimates = shop
    ? await prisma.estimateLog.findMany({
        where: { shopId: shop.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  const zoneCount = shop?.shippingZones.length ?? 0;
  const excludedDateCount = shop?.excludedDates.length ?? 0;
  const hasSettings = !!shop;
  const hasZones = zoneCount > 0;

  return json({
    shopDomain: session.shop,
    isConfigured: hasSettings,
    hasZones,
    zoneCount,
    excludedDateCount,
    estimateCount,
    recentEstimates,
    processingDays: shop?.processingDays ?? 1,
    cutoffTime: shop?.cutoffTime ?? "14:00",
    skipWeekends: shop?.skipWeekends ?? true,
  });
};

export default function Index() {
  const {
    shopDomain,
    isConfigured,
    hasZones,
    zoneCount,
    excludedDateCount,
    estimateCount,
    recentEstimates,
    processingDays,
    cutoffTime,
    skipWeekends,
  } = useLoaderData<typeof loader>();

  const onboardingComplete = isConfigured && hasZones;

  return (
    <Page title="Estimated Delivery Dates">
      <BlockStack gap="500">
        <Layout>
          {!onboardingComplete && (
            <Layout.Section>
              <Banner
                title="Complete setup to start showing delivery estimates"
                tone="info"
              >
                <List type="number">
                  <List.Item>
                    {isConfigured ? (
                      <Text as="span" tone="subdued">
                        <s>Configure processing settings</s> Done
                      </Text>
                    ) : (
                      <Text as="span">
                        <a href="/app/settings">Configure processing settings</a>
                      </Text>
                    )}
                  </List.Item>
                  <List.Item>
                    {hasZones ? (
                      <Text as="span" tone="subdued">
                        <s>Add at least one shipping zone</s> Done
                      </Text>
                    ) : (
                      <Text as="span">
                        <a href="/app/zones/new">Add at least one shipping zone</a>
                      </Text>
                    )}
                  </List.Item>
                  <List.Item>
                    Enable the delivery date block in your theme editor
                  </List.Item>
                </List>
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Store Overview
                </Text>
                <Text as="p" variant="bodyLg" fontWeight="semibold">
                  {shopDomain}
                </Text>
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Processing:</Text>
                    <Badge>{`${processingDays} business day${processingDays !== 1 ? "s" : ""}`}</Badge>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Cutoff:</Text>
                    <Badge>{cutoffTime}</Badge>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Weekends:</Text>
                    <Badge tone={skipWeekends ? "attention" : "success"}>
                      {skipWeekends ? "Skipped" : "Included"}
                    </Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Statistics
                </Text>
                <BlockStack gap="200">
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Shipping zones:</Text>
                    <Badge tone={zoneCount > 0 ? "success" : "attention"}>
                      {String(zoneCount)}
                    </Badge>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Excluded dates:</Text>
                    <Badge>{String(excludedDateCount)}</Badge>
                  </InlineStack>
                  <InlineStack gap="200" align="start">
                    <Text as="span" variant="bodyMd">Estimates served:</Text>
                    <Badge tone="info">{String(estimateCount)}</Badge>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {recentEstimates.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Recent Estimates
                  </Text>
                  <List>
                    {recentEstimates.map((log) => (
                      <List.Item key={log.id}>
                        {log.zone}: {log.estimate}{" "}
                        <Text as="span" tone="subdued">
                          ({new Date(log.createdAt).toLocaleDateString()})
                        </Text>
                      </List.Item>
                    ))}
                  </List>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}

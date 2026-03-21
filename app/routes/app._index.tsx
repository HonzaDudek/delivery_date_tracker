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

  const zoneCount = shop?.shippingZones.length ?? 0;
  const hasExcludedDates = (shop?.excludedDates.length ?? 0) > 0;

  return json({
    shopDomain: session.shop,
    isConfigured: !!shop,
    zoneCount,
    hasExcludedDates,
  });
};

export default function Index() {
  const { shopDomain, isConfigured, zoneCount, hasExcludedDates } =
    useLoaderData<typeof loader>();

  return (
    <Page title="Estimated Delivery Dates">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            {!isConfigured && (
              <Banner
                title="Welcome! Let's get started"
                tone="info"
                action={{ content: "Configure Settings", url: "/app/settings" }}
              >
                <p>
                  Set up your processing times and shipping zones to start
                  showing delivery date estimates to your customers.
                </p>
              </Banner>
            )}
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Store: {shopDomain}
                </Text>
                <List>
                  <List.Item>
                    Shipping zones configured: {zoneCount}
                  </List.Item>
                  <List.Item>
                    Excluded dates: {hasExcludedDates ? "Yes" : "Not set"}
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Quick Start
                </Text>
                <List type="number">
                  <List.Item>Configure your processing time and cutoff</List.Item>
                  <List.Item>Add shipping zones with transit times</List.Item>
                  <List.Item>
                    Enable the delivery date block in your theme editor
                  </List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}

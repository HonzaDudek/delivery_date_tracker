import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  Banner,
  InlineStack,
  Badge,
  List,
  Divider,
  Box,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLANS } from "../services/billing-types";
import { BillingService } from "../services/billing";
import { prismaShopStore } from "../services/billing-store.server";
import { isPaidPlan } from "../services/plan-enforcement";
import type { PlanId } from "../services/billing-types";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: { _count: { select: { shippingZones: true } } },
  });

  if (!shop) {
    return json({ currentPlan: "free" as PlanId, zoneCount: 0, plans: PLANS });
  }

  return json({
    currentPlan: shop.plan as PlanId,
    zoneCount: shop._count.shippingZones,
    plans: PLANS,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  if (intent === "upgrade") {
    const appUrl = process.env.SHOPIFY_APP_URL || "";
    const billing = new BillingService(
      {
        query: async (query, variables) => {
          const response = await admin.graphql(query, {
            variables: variables as Record<string, unknown>,
          });
          return response.json();
        },
      },
      prismaShopStore,
      `${appUrl}/app/billing`,
      process.env.NODE_ENV !== "production"
    );

    try {
      const result = await billing.createProSubscription(shop.id);
      return redirect(result.confirmationUrl);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create subscription";
      return json({ error: message }, { status: 500 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function Billing() {
  const { currentPlan, zoneCount, plans } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const isOnPro = currentPlan === "pro";

  return (
    <Page title="Billing" backAction={{ content: "Home", url: "/app" }}>
      <BlockStack gap="500">
        <Banner tone="info">
          <p>
            You are currently on the{" "}
            <strong>{plans[currentPlan].name}</strong> plan.
            {isOnPro
              ? " You have access to all features."
              : " Upgrade to Pro for unlimited shipping zones and more."}
          </p>
        </Banner>

        <Layout>
          {/* Free Plan */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h2">
                    Free
                  </Text>
                  {!isOnPro && <Badge tone="success">Current</Badge>}
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  $0
                  <Text variant="bodySm" as="span">
                    /month
                  </Text>
                </Text>
                <Divider />
                <List>
                  <List.Item>1 shipping zone</List.Item>
                  <List.Item>Basic date display</List.Item>
                  <List.Item>Shopify branding included</List.Item>
                </List>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Pro Plan */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text variant="headingLg" as="h2">
                    Pro
                  </Text>
                  {isOnPro && <Badge tone="success">Current</Badge>}
                </InlineStack>
                <Text variant="heading2xl" as="p">
                  $9.99
                  <Text variant="bodySm" as="span">
                    /month
                  </Text>
                </Text>
                <Divider />
                <List>
                  <List.Item>Unlimited shipping zones</List.Item>
                  <List.Item>Custom styling</List.Item>
                  <List.Item>No branding</List.Item>
                  <List.Item>Analytics dashboard</List.Item>
                  <List.Item>7-day free trial</List.Item>
                </List>
                <Box paddingBlockStart="200">
                  {!isOnPro && (
                    <Button
                      variant="primary"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("intent", "upgrade");
                        submit(formData, { method: "post" });
                      }}
                      loading={isSubmitting}
                    >
                      Start free trial
                    </Button>
                  )}
                </Box>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {!isOnPro && zoneCount >= 1 && (
          <Banner tone="warning">
            <p>
              You have {zoneCount} shipping zone{zoneCount !== 1 ? "s" : ""}.
              The Free plan supports 1 zone. Upgrade to Pro for unlimited zones.
            </p>
          </Banner>
        )}
      </BlockStack>
    </Page>
  );
}

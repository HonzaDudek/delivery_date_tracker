import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  List,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function Privacy() {
  return (
    <Page
      title="Privacy Policy"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">
                Privacy Policy — Estimated Delivery Dates
              </Text>
              <Text as="p" variant="bodyMd">
                Last updated: March 2026
              </Text>

              <Text as="h3" variant="headingMd">
                What data we collect
              </Text>
              <Text as="p" variant="bodyMd">
                This app collects the following data from your Shopify store:
              </Text>
              <List>
                <List.Item>
                  <strong>Store configuration:</strong> Shop domain, timezone,
                  processing time settings, shipping zone configurations, and
                  excluded dates. This is required to calculate delivery
                  estimates.
                </List.Item>
                <List.Item>
                  <strong>Estimate logs:</strong> Anonymous records of delivery
                  estimate calculations (shipping zone, product ID, computed
                  estimate). These contain no personally identifiable customer
                  information.
                </List.Item>
                <List.Item>
                  <strong>Session data:</strong> Shopify session tokens for
                  authentication, managed by Shopify&apos;s standard session
                  storage.
                </List.Item>
              </List>

              <Text as="h3" variant="headingMd">
                What data we do NOT collect
              </Text>
              <List>
                <List.Item>Customer names, email addresses, or phone numbers</List.Item>
                <List.Item>Customer shipping or billing addresses</List.Item>
                <List.Item>Payment or financial information</List.Item>
                <List.Item>Order details or purchase history</List.Item>
                <List.Item>Browsing behavior or tracking data</List.Item>
              </List>

              <Text as="h3" variant="headingMd">
                How we use your data
              </Text>
              <Text as="p" variant="bodyMd">
                Your store configuration is used solely to calculate and display
                estimated delivery dates to your customers. Estimate logs are
                used to provide usage analytics in the app dashboard.
              </Text>

              <Text as="h3" variant="headingMd">
                Data sharing
              </Text>
              <Text as="p" variant="bodyMd">
                We do not sell, share, or transfer your data to any third
                parties. Your data is only used within this application to
                provide delivery estimate functionality.
              </Text>

              <Text as="h3" variant="headingMd">
                Data retention and deletion
              </Text>
              <Text as="p" variant="bodyMd">
                When you uninstall the app, all your store data (settings,
                shipping zones, excluded dates, and estimate logs) is
                automatically deleted. We also respond to Shopify&apos;s GDPR
                data erasure webhooks to ensure complete data removal within 48
                hours of uninstall.
              </Text>

              <Text as="h3" variant="headingMd">
                GDPR compliance
              </Text>
              <Text as="p" variant="bodyMd">
                This app complies with GDPR requirements. We handle all
                mandatory Shopify GDPR webhooks:
              </Text>
              <List>
                <List.Item>
                  <strong>Customer data request:</strong> Since we store no
                  customer PII, we confirm no data exists.
                </List.Item>
                <List.Item>
                  <strong>Customer data erasure:</strong> Since we store no
                  customer PII, no data needs to be deleted.
                </List.Item>
                <List.Item>
                  <strong>Shop data erasure:</strong> All shop configuration and
                  logs are permanently deleted.
                </List.Item>
              </List>

              <Text as="h3" variant="headingMd">
                Contact
              </Text>
              <Text as="p" variant="bodyMd">
                For privacy-related questions or data requests, please contact
                us at privacy@estimateddeliverydates.app.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigate } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Badge,
  EmptyState,
  BlockStack,
} from "@shopify/polaris";
import { useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: { shippingZones: true },
  });

  return json({ zones: shop?.shippingZones ?? [] });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ error: "Shop not found" }, { status: 404 });
  }

  if (intent === "delete") {
    const zoneId = String(formData.get("zoneId"));
    await prisma.shippingZone.delete({ where: { id: zoneId } });
    return json({ status: "deleted" });
  }

  return json({ status: "ok" });
};

export default function Zones() {
  const { zones } = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const resourceName = {
    singular: "shipping zone",
    plural: "shipping zones",
  };

  const handleRowClick = useCallback(
    (id: string) => {
      navigate(`/app/zones/${id}`);
    },
    [navigate]
  );

  const emptyStateMarkup = (
    <EmptyState
      heading="Configure your shipping zones"
      action={{ content: "Add zone", url: "/app/zones/new" }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>
        Add shipping zones to map customer regions to carriers and transit times.
      </p>
    </EmptyState>
  );

  const rowMarkup = zones.map((zone, index) => (
    <IndexTable.Row
      id={zone.id}
      key={zone.id}
      position={index}
      onClick={() => handleRowClick(zone.id)}
    >
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {zone.name}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{zone.carrier}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge>
          {zone.transitDaysMin === zone.transitDaysMax
            ? `${zone.transitDaysMin} days`
            : `${zone.transitDaysMin}-${zone.transitDaysMax} days`}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>{zone.countries}</IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Shipping Zones"
      backAction={{ content: "Home", url: "/app" }}
      primaryAction={{ content: "Add zone", url: "/app/zones/new" }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <BlockStack gap="0">
              {zones.length === 0 ? (
                emptyStateMarkup
              ) : (
                <IndexTable
                  resourceName={resourceName}
                  itemCount={zones.length}
                  headings={[
                    { title: "Name" },
                    { title: "Carrier" },
                    { title: "Transit Time" },
                    { title: "Countries" },
                  ]}
                  selectable={false}
                >
                  {rowMarkup}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

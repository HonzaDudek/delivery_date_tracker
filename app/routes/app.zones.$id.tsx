import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  BlockStack,
  PageActions,
  Banner,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  const zone = await prisma.shippingZone.findFirst({
    where: { id: params.id, shopId: shop?.id ?? "" },
  });

  if (!zone) {
    throw new Response("Zone not found", { status: 404 });
  }

  return json({ zone });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ status: "error", message: "Shop not found" }, { status: 404 });
  }

  // Verify zone belongs to this shop
  const existingZone = await prisma.shippingZone.findFirst({
    where: { id: params.id, shopId: shop.id },
  });

  if (!existingZone) {
    return json({ status: "error", message: "Zone not found" }, { status: 404 });
  }

  if (intent === "delete") {
    await prisma.shippingZone.delete({ where: { id: params.id } });
    return redirect("/app/zones");
  }

  const name = String(formData.get("name") || "").trim();
  const countries = String(formData.get("countries") || "").trim();
  const regions = String(formData.get("regions") || "").trim();
  const carrier = String(formData.get("carrier") || "");
  const transitDaysMin = Number(formData.get("transitDaysMin"));
  const transitDaysMax = Number(formData.get("transitDaysMax"));

  const errors: string[] = [];
  if (!name) errors.push("Zone name is required");
  if (!countries) errors.push("At least one country is required");
  if (!carrier) errors.push("Carrier is required");
  if (isNaN(transitDaysMin) || transitDaysMin < 1) errors.push("Minimum transit days must be at least 1");
  if (isNaN(transitDaysMax) || transitDaysMax < 1) errors.push("Maximum transit days must be at least 1");
  if (transitDaysMin > transitDaysMax) errors.push("Minimum transit days cannot exceed maximum");

  if (errors.length > 0) {
    return json({ status: "error", message: errors.join(". ") });
  }

  await prisma.shippingZone.update({
    where: { id: params.id },
    data: { name, countries, regions, carrier, transitDaysMin, transitDaysMax },
  });

  return redirect("/app/zones");
};

export default function EditZone() {
  const { zone } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [name, setName] = useState(zone.name);
  const [countries, setCountries] = useState(zone.countries);
  const [regions, setRegions] = useState(zone.regions);
  const [carrier, setCarrier] = useState(zone.carrier);
  const [transitDaysMin, setTransitDaysMin] = useState(String(zone.transitDaysMin));
  const [transitDaysMax, setTransitDaysMax] = useState(String(zone.transitDaysMax));

  const carrierOptions = [
    { label: "USPS", value: "USPS" },
    { label: "UPS", value: "UPS" },
    { label: "FedEx", value: "FedEx" },
    { label: "DHL", value: "DHL" },
    { label: "Other", value: "Other" },
  ];

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("name", name);
    formData.set("countries", countries);
    formData.set("regions", regions);
    formData.set("carrier", carrier);
    formData.set("transitDaysMin", transitDaysMin);
    formData.set("transitDaysMax", transitDaysMax);
    submit(formData, { method: "post" });
  }, [name, countries, regions, carrier, transitDaysMin, transitDaysMax, submit]);

  const handleDelete = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "delete");
    submit(formData, { method: "post" });
  }, [submit]);

  return (
    <Page
      title={`Edit: ${zone.name}`}
      backAction={{ content: "Shipping Zones", url: "/app/zones" }}
    >
      <BlockStack gap="400">
        {actionData?.status === "error" && (
          <Banner tone="critical">
            <p>{actionData.message}</p>
          </Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Zone Details"
            description="Name and geographic coverage for this shipping zone."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Zone name"
                  value={name}
                  onChange={setName}
                  autoComplete="off"
                  requiredIndicator
                />
                <TextField
                  label="Countries"
                  value={countries}
                  onChange={setCountries}
                  autoComplete="off"
                  helpText="Comma-separated ISO country codes"
                  requiredIndicator
                />
                <TextField
                  label="Regions (optional)"
                  value={regions}
                  onChange={setRegions}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Carrier & Transit Time"
            description="The shipping carrier and estimated transit days for this zone."
          >
            <Card>
              <FormLayout>
                <Select
                  label="Carrier"
                  options={carrierOptions}
                  value={carrier}
                  onChange={setCarrier}
                  requiredIndicator
                />
                <FormLayout.Group>
                  <TextField
                    label="Min transit days"
                    type="number"
                    value={transitDaysMin}
                    onChange={setTransitDaysMin}
                    min={1}
                    max={60}
                    autoComplete="off"
                    requiredIndicator
                  />
                  <TextField
                    label="Max transit days"
                    type="number"
                    value={transitDaysMax}
                    onChange={setTransitDaysMax}
                    min={1}
                    max={60}
                    autoComplete="off"
                    requiredIndicator
                  />
                </FormLayout.Group>
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <PageActions
          primaryAction={{
            content: "Save zone",
            onAction: handleSave,
            loading: isSubmitting,
          }}
          secondaryActions={[
            { content: "Cancel", url: "/app/zones" },
            {
              content: "Delete zone",
              destructive: true,
              onAction: handleDelete,
            },
          ]}
        />
      </BlockStack>
    </Page>
  );
}

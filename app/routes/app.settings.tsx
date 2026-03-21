import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  BlockStack,
  PageActions,
} from "@shopify/polaris";
import { useState, useCallback } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopifyDomain: session.shop,
        shopifyId: session.shop,
      },
    });
  }

  return json({ shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await prisma.shop.update({
    where: { shopifyDomain: session.shop },
    data: {
      processingDays: Number(formData.get("processingDays")) || 1,
      cutoffTime: String(formData.get("cutoffTime") || "14:00"),
      timezone: String(formData.get("timezone") || "America/New_York"),
      skipWeekends: formData.get("skipWeekends") === "true",
    },
  });

  return json({ status: "success" });
};

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [processingDays, setProcessingDays] = useState(
    String(shop.processingDays)
  );
  const [cutoffTime, setCutoffTime] = useState(shop.cutoffTime);
  const [timezone, setTimezone] = useState(shop.timezone);
  const [skipWeekends, setSkipWeekends] = useState(shop.skipWeekends);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("processingDays", processingDays);
    formData.set("cutoffTime", cutoffTime);
    formData.set("timezone", timezone);
    formData.set("skipWeekends", String(skipWeekends));
    submit(formData, { method: "post" });
  }, [processingDays, cutoffTime, timezone, skipWeekends, submit]);

  const timezoneOptions = [
    { label: "Eastern (America/New_York)", value: "America/New_York" },
    { label: "Central (America/Chicago)", value: "America/Chicago" },
    { label: "Mountain (America/Denver)", value: "America/Denver" },
    { label: "Pacific (America/Los_Angeles)", value: "America/Los_Angeles" },
    { label: "UTC", value: "UTC" },
  ];

  return (
    <Page
      title="Settings"
      backAction={{ content: "Home", url: "/app" }}
    >
      <Layout>
        <Layout.AnnotatedSection
          title="Processing Time"
          description="How long it takes to fulfill an order before handing it to the carrier."
        >
          <Card>
            <FormLayout>
              <TextField
                label="Processing days"
                type="number"
                value={processingDays}
                onChange={setProcessingDays}
                min={0}
                max={30}
                autoComplete="off"
                helpText="Business days needed to process and ship an order"
              />
              <TextField
                label="Daily cutoff time"
                type="time"
                value={cutoffTime}
                onChange={setCutoffTime}
                autoComplete="off"
                helpText="Orders placed after this time count as next business day"
              />
              <Select
                label="Store timezone"
                options={timezoneOptions}
                value={timezone}
                onChange={setTimezone}
              />
              <Checkbox
                label="Skip weekends"
                checked={skipWeekends}
                onChange={setSkipWeekends}
                helpText="Exclude Saturdays and Sundays from processing and transit calculations"
              />
            </FormLayout>
          </Card>
        </Layout.AnnotatedSection>
      </Layout>
      <PageActions
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: isSubmitting,
        }}
      />
    </Page>
  );
}

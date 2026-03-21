import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, useActionData } from "@remix-run/react";
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
  IndexTable,
  Text,
  Button,
  InlineStack,
  Modal,
  Banner,
  Badge,
} from "@shopify/polaris";
import { useState, useCallback, useEffect } from "react";

import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  let shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
    include: { excludedDates: { orderBy: { date: "asc" } } },
  });

  if (!shop) {
    shop = await prisma.shop.create({
      data: {
        shopifyDomain: session.shop,
        shopifyId: session.shop,
      },
      include: { excludedDates: { orderBy: { date: "asc" } } },
    });
  }

  return json({ shop });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  const shop = await prisma.shop.findUnique({
    where: { shopifyDomain: session.shop },
  });

  if (!shop) {
    return json({ status: "error", message: "Shop not found" }, { status: 404 });
  }

  if (intent === "saveSettings") {
    const processingDays = Number(formData.get("processingDays"));
    if (isNaN(processingDays) || processingDays < 0 || processingDays > 30) {
      return json({
        status: "error",
        message: "Processing days must be between 0 and 30",
      });
    }

    const cutoffTime = String(formData.get("cutoffTime") || "14:00");
    if (!/^\d{2}:\d{2}$/.test(cutoffTime)) {
      return json({
        status: "error",
        message: "Cutoff time must be in HH:MM format",
      });
    }

    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        processingDays,
        cutoffTime,
        timezone: String(formData.get("timezone") || "America/New_York"),
        skipWeekends: formData.get("skipWeekends") === "true",
      },
    });

    return json({ status: "success", message: "Settings saved" });
  }

  if (intent === "addExcludedDate") {
    const date = String(formData.get("date") || "");
    const reason = String(formData.get("reason") || "");
    const recurring = formData.get("recurring") === "true";

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({
        status: "error",
        message: "Please enter a valid date (YYYY-MM-DD)",
      });
    }

    const existing = await prisma.excludedDate.findFirst({
      where: { shopId: shop.id, date },
    });

    if (existing) {
      return json({
        status: "error",
        message: "This date is already excluded",
      });
    }

    await prisma.excludedDate.create({
      data: { shopId: shop.id, date, reason, recurring },
    });

    return json({ status: "success", message: "Excluded date added" });
  }

  if (intent === "deleteExcludedDate") {
    const dateId = String(formData.get("dateId"));
    // Verify the excluded date belongs to this shop before deleting
    const excludedDate = await prisma.excludedDate.findFirst({
      where: { id: dateId, shopId: shop.id },
    });
    if (!excludedDate) {
      return json({ status: "error", message: "Excluded date not found" }, { status: 404 });
    }
    await prisma.excludedDate.delete({ where: { id: dateId } });
    return json({ status: "success", message: "Excluded date removed" });
  }

  return json({ status: "error", message: "Unknown action" });
};

export default function Settings() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [processingDays, setProcessingDays] = useState(
    String(shop.processingDays)
  );
  const [cutoffTime, setCutoffTime] = useState(shop.cutoffTime);
  const [timezone, setTimezone] = useState(shop.timezone);
  const [skipWeekends, setSkipWeekends] = useState(shop.skipWeekends);

  // Excluded dates modal state
  const [showDateModal, setShowDateModal] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newDateReason, setNewDateReason] = useState("");
  const [newDateRecurring, setNewDateRecurring] = useState(false);

  // Toast / banner state
  const [showBanner, setShowBanner] = useState(false);
  const [bannerMessage, setBannerMessage] = useState("");
  const [bannerTone, setBannerTone] = useState<"success" | "critical">("success");

  useEffect(() => {
    if (actionData?.status === "success") {
      setBannerMessage(actionData.message);
      setBannerTone("success");
      setShowBanner(true);
      setShowDateModal(false);
      setNewDate("");
      setNewDateReason("");
      setNewDateRecurring(false);
    } else if (actionData?.status === "error") {
      setBannerMessage(actionData.message);
      setBannerTone("critical");
      setShowBanner(true);
    }
  }, [actionData]);

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "saveSettings");
    formData.set("processingDays", processingDays);
    formData.set("cutoffTime", cutoffTime);
    formData.set("timezone", timezone);
    formData.set("skipWeekends", String(skipWeekends));
    submit(formData, { method: "post" });
  }, [processingDays, cutoffTime, timezone, skipWeekends, submit]);

  const handleAddExcludedDate = useCallback(() => {
    const formData = new FormData();
    formData.set("intent", "addExcludedDate");
    formData.set("date", newDate);
    formData.set("reason", newDateReason);
    formData.set("recurring", String(newDateRecurring));
    submit(formData, { method: "post" });
  }, [newDate, newDateReason, newDateRecurring, submit]);

  const handleDeleteExcludedDate = useCallback(
    (dateId: string) => {
      const formData = new FormData();
      formData.set("intent", "deleteExcludedDate");
      formData.set("dateId", dateId);
      submit(formData, { method: "post" });
    },
    [submit]
  );

  const timezoneOptions = [
    { label: "Eastern (America/New_York)", value: "America/New_York" },
    { label: "Central (America/Chicago)", value: "America/Chicago" },
    { label: "Mountain (America/Denver)", value: "America/Denver" },
    { label: "Pacific (America/Los_Angeles)", value: "America/Los_Angeles" },
    { label: "Hawaii (Pacific/Honolulu)", value: "Pacific/Honolulu" },
    { label: "Alaska (America/Anchorage)", value: "America/Anchorage" },
    { label: "UTC", value: "UTC" },
    { label: "London (Europe/London)", value: "Europe/London" },
    { label: "Berlin (Europe/Berlin)", value: "Europe/Berlin" },
    { label: "Tokyo (Asia/Tokyo)", value: "Asia/Tokyo" },
    { label: "Sydney (Australia/Sydney)", value: "Australia/Sydney" },
  ];

  const excludedDateRows = shop.excludedDates.map((ed, index) => (
    <IndexTable.Row id={ed.id} key={ed.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="bold" as="span">
          {ed.date}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>{ed.reason || "—"}</IndexTable.Cell>
      <IndexTable.Cell>
        {ed.recurring ? <Badge tone="info">Recurring</Badge> : <Badge>One-time</Badge>}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button
          variant="plain"
          tone="critical"
          onClick={() => handleDeleteExcludedDate(ed.id)}
        >
          Remove
        </Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Settings" backAction={{ content: "Home", url: "/app" }}>
      <BlockStack gap="400">
        {showBanner && (
          <Banner
            tone={bannerTone}
            onDismiss={() => setShowBanner(false)}
          >
            <p>{bannerMessage}</p>
          </Banner>
        )}

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

          <Layout.AnnotatedSection
            title="Excluded Dates"
            description="Dates when your warehouse does not process orders (holidays, closures, etc.)."
          >
            <Card>
              <BlockStack gap="400">
                <InlineStack align="end">
                  <Button onClick={() => setShowDateModal(true)}>
                    Add excluded date
                  </Button>
                </InlineStack>
                {shop.excludedDates.length === 0 ? (
                  <Text as="p" tone="subdued">
                    No excluded dates configured. Orders will be processed on all
                    business days.
                  </Text>
                ) : (
                  <IndexTable
                    resourceName={{
                      singular: "excluded date",
                      plural: "excluded dates",
                    }}
                    itemCount={shop.excludedDates.length}
                    headings={[
                      { title: "Date" },
                      { title: "Reason" },
                      { title: "Type" },
                      { title: "" },
                    ]}
                    selectable={false}
                  >
                    {excludedDateRows}
                  </IndexTable>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <PageActions
          primaryAction={{
            content: "Save settings",
            onAction: handleSave,
            loading: isSubmitting,
          }}
        />

        <Modal
          open={showDateModal}
          onClose={() => setShowDateModal(false)}
          title="Add excluded date"
          primaryAction={{
            content: "Add date",
            onAction: handleAddExcludedDate,
            loading: isSubmitting,
          }}
          secondaryActions={[
            {
              content: "Cancel",
              onAction: () => setShowDateModal(false),
            },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Date"
                type="date"
                value={newDate}
                onChange={setNewDate}
                autoComplete="off"
                helpText="Select the date to exclude from processing"
              />
              <TextField
                label="Reason (optional)"
                value={newDateReason}
                onChange={setNewDateReason}
                autoComplete="off"
                placeholder="e.g., Christmas Day"
              />
              <Checkbox
                label="Recurring annually"
                checked={newDateRecurring}
                onChange={setNewDateRecurring}
                helpText="If checked, this date will be excluded every year"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      </BlockStack>
    </Page>
  );
}

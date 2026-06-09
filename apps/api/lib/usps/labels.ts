import { getUspsAccessToken, getUspsPaymentAuthorizationToken } from "./auth";
import { getUspsBaseUrl } from "./config";
import { decodeLabelContent } from "./decodeLabelContent";
import { parseMultipartResponse } from "./multipart";
import type { CreateUspsLabelInput, CreateUspsLabelResult } from "./types";

export async function createUspsLabel(input: CreateUspsLabelInput): Promise<CreateUspsLabelResult> {
  const accessToken = await getUspsAccessToken();
  const paymentToken = await getUspsPaymentAuthorizationToken();

  const mailingDate =
    input.mailingDate ?? new Date().toISOString().slice(0, 10);

  const res = await fetch(`${getUspsBaseUrl()}/labels/v3/label`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Payment-Authorization-Token": paymentToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageInfo: {
        imageType: "PDF",
        labelType: "4X6LABEL",
        receiptOption: "NONE",
        suppressPostage: false,
        suppressMailDate: false,
        returnLabel: false,
      },
      toAddress: input.toAddress,
      fromAddress: input.fromAddress,
      packageDescription: {
        mailClass: "USPS_GROUND_ADVANTAGE",
        rateIndicator: "SP",
        weightUOM: "lb",
        weight: input.weightLb,
        dimensionsUOM: "in",
        length: input.lengthIn,
        width: input.widthIn,
        height: input.heightIn,
        processingCategory: "MACHINABLE",
        mailingDate,
        extraServices: [],
        destinationEntryFacilityType: "NONE"
      },
    }),
    ...({ cache: "no-store" } as RequestInit),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`USPS label creation failed: ${res.status} ${text}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  const rawBuffer = Buffer.from(arrayBuffer);
  const contentType = res.headers.get("content-type");
  const rawText = rawBuffer.toString("utf8");

  let metadata: any = null;
  let labelBuffer: Buffer | undefined;
  let labelContentType: string | undefined;

  if (contentType?.includes("multipart")) {
    const parts = parseMultipartResponse(contentType, rawBuffer);

    for (const part of parts) {
      const disposition = part.headers["content-disposition"] ?? "";
      const partContentType = part.headers["content-type"] ?? "";

      if (disposition.includes('name="labelMetadata"')) {
        metadata = JSON.parse(part.content.toString("utf8"));
      } else if (disposition.includes('name="labelImage"')) {
        labelBuffer = decodeLabelContent(part.content);
        labelContentType = partContentType;
      }
    }
  } else {
    throw new Error(`Unexpected USPS label response type: ${contentType}`);
  }

  if (!metadata?.trackingNumber) {
    throw new Error("USPS label response missing tracking number");
  }

  const trackingUrl =
    Array.isArray(metadata.links)
      ? metadata.links.find((x: any) => Array.isArray(x.rel) && x.rel.includes("Tracking URL"))?.href
      : undefined;

  return {
    trackingNumber: metadata.trackingNumber,
    postage: metadata.postage,
    serviceName: metadata.commitment?.name,
    scheduledDeliveryDate: metadata.commitment?.scheduleDeliveryDate,
    trackingUrl,
    labelBuffer,
    labelContentType,
    metadata,
    rawText,
  };
}
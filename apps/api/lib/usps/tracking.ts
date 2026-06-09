import { getUspsAccessToken } from "./auth";
import { getUspsBaseUrl } from "./config";
import type { UspsTrackingApiResponse, UspsTrackingResult } from "./types";

export async function getUspsTracking(trackingNumber: string): Promise<UspsTrackingResult> {
  const accessToken = await getUspsAccessToken();

  const url = `${getUspsBaseUrl()}/tracking/v3r2/tracking`;

  const payload = [
    {
      "trackingNumber": trackingNumber,
    },
  ];

  const res = await fetch(url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    ...({ cache: "no-store" } as RequestInit),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`USPS tracking failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as UspsTrackingApiResponse;

  return {
    trackingNumber,
    status: data?.[0]?.status,
    statusSummary: data?.[0]?.statusSummary,
    statusCategory: data?.[0]?.statusCategory
  };
}
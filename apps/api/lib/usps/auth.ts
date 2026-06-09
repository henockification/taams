import { getUspsBaseUrl } from "./config";

interface UspsTokenResponse {
  access_token: string;
  expires_in?: number;
}

interface UspsPaymentAuthResponse {
  paymentAuthorizationToken: string;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;
let cachedPaymentToken: { token: string; expiresAt: number } | null = null;

export async function getUspsAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const res = await fetch(`${getUspsBaseUrl()}/oauth2/v3/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.USPS_CLIENT_ID,
      client_secret: process.env.USPS_CLIENT_SECRET,
      grant_type: "client_credentials",
    }),
    ...({ cache: "no-store" } as RequestInit),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`USPS OAuth failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as UspsTokenResponse;
  const expiresInSeconds = Number(data.expires_in ?? 0);

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + expiresInSeconds * 1000,
  };

  return data.access_token;
}

export async function getUspsPaymentAuthorizationToken(): Promise<string> {
  const now = Date.now();
  if (cachedPaymentToken && cachedPaymentToken.expiresAt > now + 60_000) {
    return cachedPaymentToken.token;
  }

  const accessToken = await getUspsAccessToken();

  const res = await fetch(`${getUspsBaseUrl()}/payments/v3/payment-authorization`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      roles: [
        {
          roleName: "PAYER",
          CRID: process.env.USPS_CRID,
          MID: process.env.USPS_MID,
          manifestMID: process.env.USPS_MANIFEST_MID ?? process.env.USPS_MID,
          accountType: "EPS",
          accountNumber: process.env.USPS_EPS_ACCOUNT_NUMBER,
        },
        {
          roleName: "LABEL_OWNER",
          CRID: process.env.USPS_CRID,
          MID: process.env.USPS_MID,
          manifestMID: process.env.USPS_MANIFEST_MID ?? process.env.USPS_MID,
          accountType: "EPS",
          accountNumber: process.env.USPS_EPS_ACCOUNT_NUMBER,
        },
      ],
    }),
    ...({ cache: "no-store" } as RequestInit),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`USPS payment authorization failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as UspsPaymentAuthResponse;

  cachedPaymentToken = {
    token: data.paymentAuthorizationToken,
    expiresAt: now + 30 * 60 * 1000,
  };

  return data.paymentAuthorizationToken;
}
import { getUspsAccessToken } from "./auth";
import { getUspsBaseUrl } from "./config";
import type { UspsAddress, UspsValidatedAddress } from "./types";

export function getDefaultShipFromAddress(): UspsAddress {
  return {
    firstName: process.env.USPS_FROM_FIRST_NAME,
    lastName: process.env.USPS_FROM_LAST_NAME,
    streetAddress: process.env.USPS_FROM_STREET!,
    secondaryAddress: process.env.USPS_FROM_SECONDARY || undefined,
    city: process.env.USPS_FROM_CITY!,
    state: process.env.USPS_FROM_STATE!,
    ZIPCode: process.env.USPS_FROM_ZIP!,
  };
}

type UspsAddressValidationResponse = {
  address?: Partial<UspsValidatedAddress>;
  addresses?: Array<Partial<UspsValidatedAddress>>;
  result?: {
    address?: Partial<UspsValidatedAddress>;
    addresses?: Array<Partial<UspsValidatedAddress>>;
  };
  [key: string]: unknown;
};

function pickNormalizedAddress(data: UspsAddressValidationResponse): Partial<UspsValidatedAddress> | undefined {
  return (
    data.address ??
    data.addresses?.[0] ??
    data.result?.address ??
    data.result?.addresses?.[0]
  );
}

export async function validateUspsAddress(address: UspsAddress): Promise<UspsValidatedAddress> {
  const accessToken = await getUspsAccessToken();
  const params = new URLSearchParams({
    streetAddress: address.streetAddress,
    city: address.city,
    state: address.state,
    ZIPCode: address.ZIPCode,
  });
  if (address.secondaryAddress) {
    params.set("secondaryAddress", address.secondaryAddress);
  }

  const res = await fetch(`${getUspsBaseUrl()}/addresses/v3/address?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    ...({ cache: "no-store" } as RequestInit),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`USPS address validation failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as UspsAddressValidationResponse;
  const normalized = pickNormalizedAddress(data);

  if (!normalized?.streetAddress || !normalized?.city || !normalized?.state || !normalized?.ZIPCode) {
    throw new Error("USPS address validation returned incomplete normalized address");
  }

  return {
    streetAddress: normalized.streetAddress,
    streetAddressAbbreviation: normalized.streetAddressAbbreviation,
    secondaryAddress: normalized.secondaryAddress,
    cityAbbreviation: normalized.cityAbbreviation,
    city: normalized.city,
    state: normalized.state,
    ZIPCode: normalized.ZIPCode,
    zipplus4: normalized.zipplus4,
    urbanization: normalized.urbanization,
    validationStatus: normalized.validationStatus,
    validationSource: normalized.validationSource ?? "USPS",
    validationMessage: normalized.validationMessage,
    uspsResponse: data,
  };
}
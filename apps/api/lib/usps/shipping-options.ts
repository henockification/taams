import { getUspsAccessToken } from "./auth";
import { getUspsBaseUrl } from "./config";
import {
  ShippingQuoteInput,
  ShippingQuoteOption,
  UspsRateOptionRaw,
  UspsShippingOptionRaw,
  UspsShippingOptionsSearchResponse,
} from "./types";
  
  export async function getUspsShippingOptions(
    input: ShippingQuoteInput
  ): Promise<ShippingQuoteOption[]> {
    const accessToken = await getUspsAccessToken();
  
    // Replace payload keys with the exact field names from the USPS Shipping Options 3.0 spec
    const payload = {
      originZIPCode: input.fromZip,
      destinationZIPCode: input.toZip,
      weight: input.weightLb,
      // weightUOM: "lb",
      // dimensionsUOM: "in",
      length: input.lengthIn,
      width: input.widthIn,
      height: input.heightIn,
      mailClasses: input.mailClasses,
      extraServices: [986, 920],
    //  processingCategory: input.isMachinable ? "MACHINABLE" : "NON_MACHINABLE"
    };
  
    const res = await fetch(`${getUspsBaseUrl()}/prices/v3/total-rates/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      ...({ cache: "no-store" } as RequestInit)
    });
  
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`USPS shipping options failed: ${res.status} ${text}`);
    }
  
    const data = (await res.json()) as UspsShippingOptionsSearchResponse;

    const rateOptions: UspsRateOptionRaw[] = data.rateOptions ?? [];
    if (rateOptions.length > 0) {
      const mappedFromRateOptions: ShippingQuoteOption[] = rateOptions.flatMap((rateOption) => {
        const rates = rateOption.rates ?? [];
        return rates.map((rate) => ({
          serviceCode: String(rate.mailClass ?? ""),
          serviceName: String(rate.description ?? rate.mailClass ?? ""),
          amount: Math.round(Number(rate.price ?? rateOption.totalPrice ?? 0) * 100),
          currency: "usd" as const,
          estimatedDays: rate.serviceStandardDays ?? null,
          raw: {
            rateOption,
            rate,
          },
        }));
      });

      if (mappedFromRateOptions.length > 0) {
        return mappedFromRateOptions;
      }
    }

    // Backward compatibility with previous USPS response shape.
    const options: UspsShippingOptionRaw[] = data.shippingOptions ?? [];
    return options.map((opt) => ({
      serviceCode: String(opt.mailClass ?? opt.serviceCode ?? ""),
      serviceName: String(opt.description ?? opt.serviceName ?? ""),
      amount: Math.round(Number(opt.price ?? 0) * 100),
      currency: "usd",
      estimatedDays: opt.serviceStandardDays ?? null,
      raw: opt,
    }));
  }
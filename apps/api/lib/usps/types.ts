export type UspsAddress = {
    firstName?: string;
    lastName?: string;
    streetAddress: string;
    secondaryAddress?: string;
    city: string;
    state: string;
    ZIPCode: string;
  };

export type UspsValidatedAddress = {
  streetAddress: string;
  streetAddressAbbreviation?: string;
  secondaryAddress?: string;
  cityAbbreviation?: string;
  city: string;
  state: string;
  ZIPCode: string;
  zipplus4?: string;
  urbanization?: string;
  validationStatus?: string;
  validationSource?: string;
  validationMessage?: string;
  uspsResponse?: unknown;
};
  
  /** Raw response shape from USPS tracking API (Tracking v3.2) */
  export type UspsTrackingEvent = {
    actionCode?: string;
    CODAmountDue?: string;
    eventCity?: string;
    eventCode?: string;
    eventCountry?: string;
    eventPartner?: string;
    eventState?: string;
    eventTimestamp?: string;
    eventType?: string;
    eventZIPCode?: string;
    firm?: string;
    GMTTimestamp?: string;
    GMTOffset?: string;
    reasonCode?: string;
    recipientName?: string;
    veriPoint?: boolean;
  };

  export type UspsDeliveryDateExpectation = {
    endOfDay?: string;
    expectedDeliveryDate?: string;
    guaranteedDeliveryDate?: string;
    guaranteedDetails?: string;
    predictedDeliveryDate?: string;
    predictedDeliverySource?: string;
    predictedDeliveryWindowStartTime?: string;
    predictedDeliveryWindowEndTime?: string;
  };

  export type UspsServicesEligibility = {
    proofOfDeliveryEnabled?: boolean;
    RREEnabled?: boolean;
    trackingProofOfDeliveryEnabled?: boolean;
  };

  export type UspsTrackingPackage = {
    trackingNumber: string;
    associatedTrackingNumber?: string;
    destinationCity?: string;
    destinationCountry?: string;
    destinationState?: string;
    destinationZIPCode?: string;
    kahalaIndicator?: boolean;
    mailClass?: string;
    mailClassCode?: string;
    mailingDate?: string;
    mailType?: string;
    originCity?: string;
    originCountry?: string;
    originState?: string;
    originZIPCode?: string;
    services?: string[];
    serviceTypeCode?: string;
    status?: string;
    statusCategory?: string;
    statusSummary?: string;
    uniqueTrackingID?: string;
    accessControl?: string;
    deliveryDateExpectation?: UspsDeliveryDateExpectation;
    servicesEligibility?: UspsServicesEligibility;
    trackingEvents?: UspsTrackingEvent[];
    [key: string]: unknown;
  };

  export type UspsTrackingApiResponse = UspsTrackingPackage[];

  export type UspsTrackingResult = {
    trackingNumber: string;
    status?: string;
    statusCategory?: string;
    statusSummary?: string;
  };
  
  export type CreateUspsLabelInput = {
    toAddress: UspsAddress;
    fromAddress: UspsAddress;
    weightLb: number;
    lengthIn?: number;
    widthIn?: number;
    heightIn?: number;
    mailClass?: "PRIORITY_MAIL" | "USPS_GROUND_ADVANTAGE";
    mailingDate?: string; // YYYY-MM-DD
    packageValue?: number;
  };
  
  export type CreateUspsLabelResult = {
    trackingNumber: string;
    postage?: number;
    serviceName?: string;
    scheduledDeliveryDate?: string;
    trackingUrl?: string;
    labelBuffer?: Buffer;
    labelContentType?: string;
    metadata: any;
    rawText: string;
  };

  export type MultipartPart = {
    headers: Record<string, string>;
    content: Buffer;
  };

  export type ShippingQuoteInput = {
    fromZip: string;
    toZip: string;
    weightLb: number;
    lengthIn?: number;
    widthIn?: number;
    heightIn?: number;
    isMachinable?: boolean;
    mailClasses?: string[];
  };
  
  export type ShippingQuoteOption = {
    serviceCode: string;
    serviceName: string;
    amount: number; // cents
    currency: "usd";
    estimatedDays?: number | null;
    raw: unknown;
  };

  /** Partial raw option from USPS shipping-options search (field names vary by API version). */
  export type UspsShippingOptionRaw = {
    mailClass?: string;
    serviceCode?: string;
    description?: string;
    serviceName?: string;
    price?: string | number;
    serviceStandardDays?: number | null;
    [key: string]: unknown;
  };

export type UspsRateRaw = {
  description?: string;
  price?: string | number;
  mailClass?: string;
  serviceStandardDays?: number | null;
  [key: string]: unknown;
};

export type UspsRateOptionRaw = {
  totalBasePrice?: string | number;
  totalPrice?: string | number;
  rates?: UspsRateRaw[];
  extraServices?: unknown[];
  [key: string]: unknown;
};

  export type UspsShippingOptionsSearchResponse = {
  rateOptions?: UspsRateOptionRaw[];
    shippingOptions?: UspsShippingOptionRaw[];
  };
export function getUspsBaseUrl() {
    return process.env.USPS_ENV === "tem"
        ? "https://apis-tem.usps.com"
        : "https://apis.usps.com";
}
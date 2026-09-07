const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export function assertPrivateDeviceAddress(ipAddress: string) {
  const match = IPV4.exec(ipAddress.trim());
  if (!match) {
    throw new Error('Device test is limited to private IPv4 addresses');
  }

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet > 255)) {
    throw new Error('Device test is limited to private IPv4 addresses');
  }

  const [a, b] = octets;
  if (a === 10) return;
  if (a === 192 && b === 168) return;
  if (a === 172 && b >= 16 && b <= 31) return;

  throw new Error('Device test is limited to private IPv4 addresses');
}

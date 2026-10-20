/**
 * Import a ZKTeco USB export (user.dat + biotemplate.dat) from the enrollment master into
 * TAAMS, for when uploading ~90 MB through the web page is not practical.
 *
 *   BIOMETRIC_TEMPLATE_KEY=... npm run biometric:import-usb -- "/path/to/export folder"
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { getEnrollmentMasterDevice, ingestEnrollment } from '../db/orm/core/manageBiometricEnrollment';
import { parseUsbBiodataFile, parseUsbUserFile } from '../lib/zkteco/enrollment/parse-records';

async function main() {
  const folder = process.argv[2];
  if (!folder) throw new Error('Usage: npm run biometric:import-usb -- <folder with user.dat and biotemplate.dat>');

  const users = parseUsbUserFile(readFileSync(join(folder, 'user.dat')));
  const templates = parseUsbBiodataFile(readFileSync(join(folder, 'biotemplate.dat'), 'utf8'));
  const master = await getEnrollmentMasterDevice();
  if (!master) console.warn('No enrollment master device is configured; users are imported without a source device.');

  const result = await ingestEnrollment({ users, templates, sourceDeviceId: master?.id ?? null, replaceTemplates: true });
  console.log(`Imported ${result.users} users and ${result.templates} template slots; ${result.linkedUsers} linked to employees.`);
  if (result.unmatchedPins.length) {
    console.log(`${result.unmatchedPins.length} PINs match no employee biometric id or code: ${result.unmatchedPins.slice(0, 50).join(', ')}${result.unmatchedPins.length > 50 ? ', ...' : ''}`);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

import { Hono } from 'hono';
import {
  applyEnrollmentSyncHandler,
  cancelPendingDeviceCommandsHandler,
  deprovisionEmployeeHandler,
  getEmployeeEnrollmentHandler,
  getEnrollmentOverviewHandler,
  getEnrollmentSyncRunsHandler,
  importUsbEnrollmentHandler,
  previewEnrollmentSyncHandler,
  provisionEmployeeHandler,
  refreshDeviceRosterHandler,
  refreshFromMasterHandler,
  retryFailedDeviceCommandsHandler,
} from './handlers/biometricEnrollment';
import { requirePermission } from '../../../middleware/rbac';
import { requireDeviceAdministrator } from '../biometric-devices/routes';

const biometricEnrollmentApp = new Hono();
const canRead = requirePermission('biometric-devices:read');

// Viewing follows device monitoring; anything that writes to devices is a system
// administration task.
biometricEnrollmentApp.get('/biometric-enrollment/overview', canRead, getEnrollmentOverviewHandler);
biometricEnrollmentApp.get('/biometric-enrollment/sync-runs', canRead, getEnrollmentSyncRunsHandler);
biometricEnrollmentApp.get('/biometric-enrollment/employees/:id', canRead, getEmployeeEnrollmentHandler);

biometricEnrollmentApp.post('/biometric-enrollment/import-usb', canRead, requireDeviceAdministrator, importUsbEnrollmentHandler);
biometricEnrollmentApp.post('/biometric-enrollment/refresh-from-master', canRead, requireDeviceAdministrator, refreshFromMasterHandler);
biometricEnrollmentApp.post('/biometric-enrollment/sync/preview', canRead, requireDeviceAdministrator, previewEnrollmentSyncHandler);
biometricEnrollmentApp.post('/biometric-enrollment/sync', canRead, requireDeviceAdministrator, applyEnrollmentSyncHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/refresh-roster', canRead, requireDeviceAdministrator, refreshDeviceRosterHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/cancel-pending', canRead, requireDeviceAdministrator, cancelPendingDeviceCommandsHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/retry-failed', canRead, requireDeviceAdministrator, retryFailedDeviceCommandsHandler);
biometricEnrollmentApp.post('/biometric-enrollment/employees/:id/provision', canRead, requireDeviceAdministrator, provisionEmployeeHandler);
biometricEnrollmentApp.post('/biometric-enrollment/employees/:id/deprovision', canRead, requireDeviceAdministrator, deprovisionEmployeeHandler);

export default biometricEnrollmentApp;

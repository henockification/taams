import { Hono } from 'hono';
import {
  applyEnrollmentSyncHandler,
  cancelPendingDeviceCommandsHandler,
  deprovisionEmployeeHandler,
  getDeviceConsoleHandler,
  getEmployeeEnrollmentHandler,
  getEnrollmentOverviewHandler,
  getEnrollmentSyncRunsHandler,
  importUsbEnrollmentHandler,
  previewEnrollmentSyncHandler,
  provisionEmployeeHandler,
  refreshDeviceRosterHandler,
  refreshFromMasterHandler,
  retryFailedDeviceCommandsHandler,
  sendDeviceConsoleCommandHandler,
} from './handlers/biometricEnrollment';
import { requirePermission, requirePermissionOrRole } from '../../../middleware/rbac';
import { PRIVILEGED_ROLE_NAMES } from '../../../lib/privileged-roles';

const biometricEnrollmentApp = new Hono();
// Enrollment has its own permissions so it can be granted apart from device monitoring.
// biometric-devices:read still opens the read-only view, as it did before.
const canRead = requirePermission('biometric-enrollment:read', 'biometric-devices:read');
// Writing to devices (sync, provision, remove) needs biometric-enrollment:push or a system administrator role.
const canManage = requirePermissionOrRole(['biometric-enrollment:push'], [...PRIVILEGED_ROLE_NAMES]);

biometricEnrollmentApp.get('/biometric-enrollment/overview', canRead, getEnrollmentOverviewHandler);
biometricEnrollmentApp.get('/biometric-enrollment/sync-runs', canRead, getEnrollmentSyncRunsHandler);
biometricEnrollmentApp.get('/biometric-enrollment/employees/:id', canRead, getEmployeeEnrollmentHandler);

biometricEnrollmentApp.post('/biometric-enrollment/import-usb', canManage, importUsbEnrollmentHandler);
biometricEnrollmentApp.post('/biometric-enrollment/refresh-from-master', canManage, refreshFromMasterHandler);
biometricEnrollmentApp.post('/biometric-enrollment/sync/preview', canManage, previewEnrollmentSyncHandler);
biometricEnrollmentApp.post('/biometric-enrollment/sync', canManage, applyEnrollmentSyncHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/refresh-roster', canManage, refreshDeviceRosterHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/cancel-pending', canManage, cancelPendingDeviceCommandsHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/retry-failed', canManage, retryFailedDeviceCommandsHandler);
// Device console: raw data/info commands and recent traffic, for troubleshooting a device.
biometricEnrollmentApp.get('/biometric-enrollment/devices/:id/console', canManage, getDeviceConsoleHandler);
biometricEnrollmentApp.post('/biometric-enrollment/devices/:id/console', canManage, sendDeviceConsoleCommandHandler);
biometricEnrollmentApp.post('/biometric-enrollment/employees/:id/provision', canManage, provisionEmployeeHandler);
biometricEnrollmentApp.post('/biometric-enrollment/employees/:id/deprovision', canManage, deprovisionEmployeeHandler);

export default biometricEnrollmentApp;

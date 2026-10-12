import { Hono } from 'hono';
import {
  changeBiometricExemptionStatusHandler,
  createBiometricExemptionHandler,
  deleteBiometricExemptionHandler,
  getBiometricExemptionsHandler,
  updateBiometricExemptionHandler,
} from './handlers/biometricExemptions';
import { requirePermission, requireHrSupervisorRole } from '../../../middleware/rbac';

const biometricExemptionsApp = new Hono();

biometricExemptionsApp.get('/biometric-exemptions', requirePermission('biometric-exemptions:read'), getBiometricExemptionsHandler);
// Every change is limited to human resource users (or super admin) in the handlers.
biometricExemptionsApp.post('/biometric-exemptions', requirePermission('biometric-exemptions:read'), requireHrSupervisorRole(), createBiometricExemptionHandler);
biometricExemptionsApp.post('/biometric-exemptions/:id/status', requirePermission('biometric-exemptions:read'), requireHrSupervisorRole(), changeBiometricExemptionStatusHandler);
biometricExemptionsApp.put('/biometric-exemptions/:id', requirePermission('biometric-exemptions:read'), requireHrSupervisorRole(), updateBiometricExemptionHandler);
biometricExemptionsApp.delete('/biometric-exemptions/:id', requirePermission('biometric-exemptions:read'), requireHrSupervisorRole(), deleteBiometricExemptionHandler);

export default biometricExemptionsApp;

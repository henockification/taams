import { Hono } from 'hono';
import {
  changeBiometricExemptionStatusHandler,
  createBiometricExemptionHandler,
  deleteBiometricExemptionHandler,
  getBiometricExemptionsHandler,
  updateBiometricExemptionHandler,
} from './handlers/biometricExemptions';
import { requirePermission, requirePermissionOrDelegation } from '../../../middleware/rbac';

const biometricExemptionsApp = new Hono();

biometricExemptionsApp.get('/biometric-exemptions', requirePermission('biometric-exemptions:read'), getBiometricExemptionsHandler);
biometricExemptionsApp.post('/biometric-exemptions', requirePermission('biometric-exemptions:read'), createBiometricExemptionHandler);
biometricExemptionsApp.post('/biometric-exemptions/:id/status', requirePermissionOrDelegation('biometric-exemptions:approve'), changeBiometricExemptionStatusHandler);
biometricExemptionsApp.put('/biometric-exemptions/:id', requirePermission('biometric-exemptions:read', 'biometric-exemptions:approve'), updateBiometricExemptionHandler);
biometricExemptionsApp.delete('/biometric-exemptions/:id', requirePermission('biometric-exemptions:approve'), deleteBiometricExemptionHandler);

export default biometricExemptionsApp;

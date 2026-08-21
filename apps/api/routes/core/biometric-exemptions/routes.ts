import { Hono } from 'hono';
import {
  changeBiometricExemptionStatusHandler,
  createBiometricExemptionHandler,
  deleteBiometricExemptionHandler,
  getBiometricExemptionsHandler,
  updateBiometricExemptionHandler,
} from './handlers/biometricExemptions';

const biometricExemptionsApp = new Hono();

biometricExemptionsApp.get('/biometric-exemptions', getBiometricExemptionsHandler);
biometricExemptionsApp.post('/biometric-exemptions', createBiometricExemptionHandler);
biometricExemptionsApp.post('/biometric-exemptions/:id/status', changeBiometricExemptionStatusHandler);
biometricExemptionsApp.put('/biometric-exemptions/:id', updateBiometricExemptionHandler);
biometricExemptionsApp.delete('/biometric-exemptions/:id', deleteBiometricExemptionHandler);

export default biometricExemptionsApp;

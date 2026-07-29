import { Hono } from 'hono';
import {
  createBiometricExemptionHandler,
  deleteBiometricExemptionHandler,
  getBiometricExemptionsHandler,
  updateBiometricExemptionHandler,
} from './handlers/biometricExemptions';

const biometricExemptionsApp = new Hono();

biometricExemptionsApp.get('/biometric-exemptions', getBiometricExemptionsHandler);
biometricExemptionsApp.post('/biometric-exemptions', createBiometricExemptionHandler);
biometricExemptionsApp.put('/biometric-exemptions/:id', updateBiometricExemptionHandler);
biometricExemptionsApp.delete('/biometric-exemptions/:id', deleteBiometricExemptionHandler);

export default biometricExemptionsApp;

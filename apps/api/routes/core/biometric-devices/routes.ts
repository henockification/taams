import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  AttendanceSyncBatchesResponseSchema,
  AttendanceSyncBatchResponseSchema,
  BiometricDeviceConnectionTestResponseSchema,
  BiometricDeviceResponseSchema,
  BiometricDevicesResponseSchema,
  CreateBiometricDeviceRequestSchema,
  UpdateBiometricDeviceRequestSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  getBiometricDeviceSyncHistoryHandler,
  syncBiometricDeviceHandler,
} from './handlers/biometricDeviceSync';
import {
  createBiometricDeviceHandler,
  getBiometricDeviceHandler,
  getBiometricDevicesHandler,
  testBiometricDeviceConnectionHandler,
  updateBiometricDeviceHandler,
} from './handlers/biometricDevices';

const biometricDevicesApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createBiometricDeviceRoute = createRoute({
  method: 'post',
  path: '/biometric-devices',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Create Biometric Device',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateBiometricDeviceRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: BiometricDeviceResponseSchema } },
      description: 'Created biometric device',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getBiometricDevicesRoute = createRoute({
  method: 'get',
  path: '/biometric-devices',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Get Biometric Devices',
  responses: {
    200: {
      content: { 'application/json': { schema: BiometricDevicesResponseSchema } },
      description: 'Biometric device list',
    },
  },
});

export const getBiometricDeviceRoute = createRoute({
  method: 'get',
  path: '/biometric-devices/{id}',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Get Biometric Device',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BiometricDeviceResponseSchema } },
      description: 'Biometric device detail',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Biometric device not found',
    },
  },
});

export const updateBiometricDeviceRoute = createRoute({
  method: 'put',
  path: '/biometric-devices/{id}',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Update Biometric Device',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateBiometricDeviceRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BiometricDeviceResponseSchema } },
      description: 'Updated biometric device',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Biometric device not found',
    },
  },
});

export const syncBiometricDeviceRoute = createRoute({
  method: 'post',
  path: '/biometric-devices/{id}/sync',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Sync Biometric Device',
  request: {
    params: uuidParam,
  },
  responses: {
    201: {
      content: { 'application/json': { schema: AttendanceSyncBatchResponseSchema } },
      description: 'Created sync batch',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Biometric device not found',
    },
  },
});

export const testBiometricDeviceConnectionRoute = createRoute({
  method: 'post',
  path: '/biometric-devices/{id}/test-connection',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Test Biometric Device Connection',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: BiometricDeviceConnectionTestResponseSchema } },
      description: 'Connection test result',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Biometric device not found',
    },
  },
});

export const getBiometricDeviceSyncHistoryRoute = createRoute({
  method: 'get',
  path: '/biometric-devices/{id}/sync-history',
  tags: ['Core', 'Biometric Devices'],
  summary: 'Get Biometric Device Sync History',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceSyncBatchesResponseSchema } },
      description: 'Sync history list',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Biometric device not found',
    },
  },
});

biometricDevicesApp.post('/biometric-devices', createBiometricDeviceHandler);
biometricDevicesApp.get('/biometric-devices', getBiometricDevicesHandler);
biometricDevicesApp.get('/biometric-devices/:id', getBiometricDeviceHandler);
biometricDevicesApp.put('/biometric-devices/:id', updateBiometricDeviceHandler);
biometricDevicesApp.post('/biometric-devices/:id/sync', syncBiometricDeviceHandler);
biometricDevicesApp.post('/biometric-devices/:id/test-connection', testBiometricDeviceConnectionHandler);
biometricDevicesApp.get('/biometric-devices/:id/sync-history', getBiometricDeviceSyncHistoryHandler);

openApiApp
  .openapi(createBiometricDeviceRoute, createBiometricDeviceHandler as any)
  .openapi(getBiometricDevicesRoute, getBiometricDevicesHandler as any)
  .openapi(getBiometricDeviceRoute, getBiometricDeviceHandler as any)
  .openapi(updateBiometricDeviceRoute, updateBiometricDeviceHandler as any)
  .openapi(syncBiometricDeviceRoute, syncBiometricDeviceHandler as any)
  .openapi(testBiometricDeviceConnectionRoute, testBiometricDeviceConnectionHandler as any)
  .openapi(getBiometricDeviceSyncHistoryRoute, getBiometricDeviceSyncHistoryHandler as any);

export default biometricDevicesApp;

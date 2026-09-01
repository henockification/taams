import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  BiometricProvisioningJobResponseSchema,
  BiometricProvisioningJobsResponseSchema,
  CreateBiometricProvisioningPreviewRequestSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  applyBiometricProvisioningPreviewHandler,
  createBiometricProvisioningPreviewHandler,
  getBiometricProvisioningJobHandler,
  getBiometricProvisioningJobsHandler,
  retryBiometricProvisioningJobHandler,
} from './handlers/biometricProvisioning';

const biometricProvisioningApp = new Hono();
const uuidParam = z.object({ id: z.string().uuid() });
const previewUuidParam = z.object({ previewId: z.string().uuid() });

const previewRoute = createRoute({
  method: 'post',
  path: '/biometric-provisioning/previews',
  tags: ['Core', 'Biometric Provisioning'],
  summary: 'Queue a read-only biometric provisioning preview',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateBiometricProvisioningPreviewRequestSchema,
        },
      },
    },
  },
  responses: {
    202: {
      content: {
        'application/json': { schema: BiometricProvisioningJobResponseSchema },
      },
      description: 'Preview queued',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});
const applyRoute = createRoute({
  method: 'post',
  path: '/biometric-provisioning/jobs/{previewId}/apply',
  tags: ['Core', 'Biometric Provisioning'],
  summary: 'Confirm and apply a completed provisioning preview',
  request: { params: previewUuidParam },
  responses: {
    202: {
      content: {
        'application/json': { schema: BiometricProvisioningJobResponseSchema },
      },
      description: 'Apply job queued',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Preview cannot be applied',
    },
  },
});
const retryRoute = createRoute({
  method: 'post',
  path: '/biometric-provisioning/jobs/{id}/retry',
  tags: ['Core', 'Biometric Provisioning'],
  summary: 'Retry only failed target devices',
  request: { params: uuidParam },
  responses: {
    202: {
      content: {
        'application/json': { schema: BiometricProvisioningJobResponseSchema },
      },
      description: 'Retry queued',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Job cannot be retried',
    },
  },
});
const detailRoute = createRoute({
  method: 'get',
  path: '/biometric-provisioning/jobs/{id}',
  tags: ['Core', 'Biometric Provisioning'],
  summary: 'Get provisioning progress and per-device results',
  request: { params: uuidParam },
  responses: {
    200: {
      content: {
        'application/json': { schema: BiometricProvisioningJobResponseSchema },
      },
      description: 'Provisioning job',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Not found',
    },
  },
});
const listRoute = createRoute({
  method: 'get',
  path: '/biometric-provisioning/jobs',
  tags: ['Core', 'Biometric Provisioning'],
  summary: 'Get biometric provisioning audit history',
  responses: {
    200: {
      content: {
        'application/json': { schema: BiometricProvisioningJobsResponseSchema },
      },
      description: 'Provisioning history',
    },
  },
});

biometricProvisioningApp.post('/biometric-provisioning/previews', createBiometricProvisioningPreviewHandler);
biometricProvisioningApp.post('/biometric-provisioning/jobs/:previewId/apply', applyBiometricProvisioningPreviewHandler);
biometricProvisioningApp.post('/biometric-provisioning/jobs/:id/retry', retryBiometricProvisioningJobHandler);
biometricProvisioningApp.get('/biometric-provisioning/jobs/:id', getBiometricProvisioningJobHandler);
biometricProvisioningApp.get('/biometric-provisioning/jobs', getBiometricProvisioningJobsHandler);

openApiApp
  .openapi(previewRoute, createBiometricProvisioningPreviewHandler as any)
  .openapi(applyRoute, applyBiometricProvisioningPreviewHandler as any)
  .openapi(retryRoute, retryBiometricProvisioningJobHandler as any)
  .openapi(detailRoute, getBiometricProvisioningJobHandler as any)
  .openapi(listRoute, getBiometricProvisioningJobsHandler as any);

export default biometricProvisioningApp;

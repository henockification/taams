// Tenant plan types
export enum PlanType {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
}

// Tenant status types
export enum TenantStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
}

// Knowledge base document status types
export enum KnowledgeBaseDocumentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// Export type unions for TypeScript usage
export type PlanTypeValue = `${PlanType}`;
export type TenantStatusValue = `${TenantStatus}`;
export type KnowledgeBaseDocumentStatusValue = `${KnowledgeBaseDocumentStatus}`;

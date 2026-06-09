import { relations } from "drizzle-orm/relations";
import { tenantsInApp, userInApp, endUsersInApp, knowledgeBasesInApp, documentProcessingJobsInApp, knowledgeDocsInApp, conversationsInApp } from "./schema";

export const userInAppRelations = relations(userInApp, ({one}) => ({
	tenantsInApp: one(tenantsInApp, {
		fields: [userInApp.tenantId],
		references: [tenantsInApp.id]
	}),
}));

export const tenantsInAppRelations = relations(tenantsInApp, ({many}) => ({
	userInApps: many(userInApp),
	endUsersInApps: many(endUsersInApp),
	knowledgeBasesInApps: many(knowledgeBasesInApp),
}));

export const endUsersInAppRelations = relations(endUsersInApp, ({one, many}) => ({
	tenantsInApp: one(tenantsInApp, {
		fields: [endUsersInApp.tenantId],
		references: [tenantsInApp.id]
	}),
	conversationsInApps: many(conversationsInApp),
}));

export const documentProcessingJobsInAppRelations = relations(documentProcessingJobsInApp, ({one}) => ({
	knowledgeBasesInApp: one(knowledgeBasesInApp, {
		fields: [documentProcessingJobsInApp.kbId],
		references: [knowledgeBasesInApp.id]
	}),
	knowledgeDocsInApp: one(knowledgeDocsInApp, {
		fields: [documentProcessingJobsInApp.documentId],
		references: [knowledgeDocsInApp.id]
	}),
}));

export const knowledgeBasesInAppRelations = relations(knowledgeBasesInApp, ({one, many}) => ({
	documentProcessingJobsInApps: many(documentProcessingJobsInApp),
	tenantsInApp: one(tenantsInApp, {
		fields: [knowledgeBasesInApp.tenantId],
		references: [tenantsInApp.id]
	}),
}));

export const knowledgeDocsInAppRelations = relations(knowledgeDocsInApp, ({many}) => ({
	documentProcessingJobsInApps: many(documentProcessingJobsInApp),
}));

export const conversationsInAppRelations = relations(conversationsInApp, ({one}) => ({
	endUsersInApp: one(endUsersInApp, {
		fields: [conversationsInApp.endUserId],
		references: [endUsersInApp.id]
	}),
}));
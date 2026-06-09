import { db } from '../../db';
import { user, customers } from '../../schema';
import { eq } from 'drizzle-orm';
import { auth } from '../../../lib/auth';
import { randomUUID } from 'crypto';
import type {
  CreateUserWithCustomerInput,
  CreateUserWithCustomerResult,
} from '../../../types/customers';

function generateCustomerCode(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CUST-${timestamp}-${random}`;
}

export async function createUserWithCustomer(
  input: CreateUserWithCustomerInput
): Promise<CreateUserWithCustomerResult> {
  let signupResult;
  try {
    signupResult = await auth.api.signUpEmail({
      body: {
        name: input.firstName + ' ' + input.lastName,
        email: input.email,
        password: input.password,
        callbackURL: input.callbackURL,
      },
    });
  } catch (authError) {
    throw new Error(
      `Failed to create user with better-auth: ${authError instanceof Error ? authError.message : 'Unknown error'}`
    );
  }

  if (!signupResult?.user) {
    throw new Error('Failed to create user with better-auth: No user returned');
  }

  const userId = signupResult.user.id;
  const joinedDate = new Date();

  try {
    await db
      .update(user)
      .set({ 
        role: ['user'],
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  } catch (roleError) {
    console.error('Failed to set user role, continuing anyway:', roleError);
  }

  let customer;
  try {
    customer = await db.transaction(async (tx) => {
      // Generate customer code - retry if unique constraint violation occurs
      let customerCode = generateCustomerCode();
      let attempts = 0;
      const maxAttempts = 5;

      while (attempts < maxAttempts) {
        try {
          const [newCustomer] = await tx
            .insert(customers)
            .values({
              userId,
              firstName: input.firstName,
              lastName: input.lastName,
              customerCode,
              email: input.email,
              phoneNumber: input.phoneNumber ?? null,
              joinedDate,
            })
            .returning();
          return newCustomer;
        } catch (insertError: any) {
          // Check if it's a unique constraint violation on customer_code or user_id
          if (insertError?.code === '23505') {
            const isCustomerCodeViolation = insertError?.message?.includes('customer_code') || 
                                           insertError?.constraint === 'uq_customers_customer_code';
            
            if (isCustomerCodeViolation) {
              attempts++;
              if (attempts >= maxAttempts) {
                // Fallback to UUID-based code
                customerCode = `CUST-${randomUUID().substring(0, 13).toUpperCase()}`;
                // Try one more time with UUID-based code
                const [newCustomer] = await tx
                  .insert(customers)
                  .values({
                    userId,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    customerCode,
                    email: input.email,
                    phoneNumber: input.phoneNumber ?? null,
                    joinedDate,
                  })
                  .returning();
                return newCustomer;
              }
              // Generate new code and retry
              customerCode = generateCustomerCode();
              continue;
            }
          }
          // If it's not a unique constraint violation on customer_code, rethrow the error
          throw insertError;
        }
      }

      throw new Error('Failed to generate unique customer code after multiple attempts');
    });

    return {
      userId,
      customerId: customer.id,
      customerCode: customer.customerCode,
    };
  } catch (error) {
    // If customer creation fails, clean up the user that was created
    console.error('Failed to create customer, cleaning up user:', error);
    
    try {
      // Delete the user and related records to rollback the entire operation
      // Note: better-auth creates account records, so we need to handle cascade
      await db.delete(user).where(eq(user.id, userId));
      console.log('Successfully cleaned up user after customer creation failure');
    } catch (cleanupError) {
      console.error('Failed to clean up user after customer creation failure:', cleanupError);
      // Log the error but throw the original error
      throw new Error(
        `Failed to create customer and cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}. Manual cleanup may be required for user ID: ${userId}`
      );
    }

    throw new Error(
      `Failed to create customer: ${error instanceof Error ? error.message : 'Unknown error'}. User has been cleaned up.`
    );
  }
}

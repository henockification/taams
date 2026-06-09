import { Context } from 'hono';
import { SignUpRequestSchema } from '../../../schemas/shared';
import { CreateUserWithCustomerInput } from '../../../types/customers';
import { createUserWithCustomer } from '../../../db/orm/users/createUser';
import { verifyTurnstileToken } from '../../../lib/turnstile';

export async function signupHandler(c: Context) {
  try {
    const body = await c.req.json();

    const isValid = await verifyTurnstileToken(body.captchaToken);
    if (!isValid) {
      return c.json(
        {
          success: false,
          error: 'Invalid or expired captcha. Please try again.',
        },
        400
      );
    }
    
    const validationResult = SignUpRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
        return c.json({
          success: false,
          error: 'Validation failed',
          details: validationResult.error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        }, 400);
    }

    const validatedData = validationResult.data;

    const dataToInsert: CreateUserWithCustomerInput = {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email,
      password: validatedData.password,
    };

    const result = await createUserWithCustomer(dataToInsert);

    return c.json({
      success: true as boolean,
      user: result,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch user',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
import { OpenAPIHono } from '@hono/zod-openapi';
import { getSessionHandler } from './handlers/getSessionHandler';
import { requestPasswordResetHandler } from './handlers/requestPasswordResetHandler';
import { resetPasswordHandler } from './handlers/resetPasswordHandler';
import { revokeOtherSessionsHandler } from './handlers/revokeOtherSessionsHandler';
import { sendVerificationOtpHandler } from './handlers/sendVerificationOtpHandler';
import { signInEmailHandler } from './handlers/signInEmailHandler';
import { signOutHandler } from './handlers/signOutHandler';
import { verifyOtpHandler } from './handlers/verifyOtpHandler';
import { requireAuth } from '../../middleware/auth';

const authApp = new OpenAPIHono();

authApp.post('/sign-in/email', signInEmailHandler);
authApp.post('/sign-out', signOutHandler);
authApp.get('/get-session', getSessionHandler);
authApp.post('/request-password-reset', requestPasswordResetHandler);
authApp.post('/reset-password', resetPasswordHandler);
authApp.post('/email-otp/verify-email', verifyOtpHandler);
authApp.post('/email-otp/send-verification-otp', sendVerificationOtpHandler);
authApp.post('/revoke-other-sessions', requireAuth, revokeOtherSessionsHandler);

authApp.all('*', (c) => {
  return c.json({
    message: 'Auth route not found',
  }, 404);
});

export default authApp;

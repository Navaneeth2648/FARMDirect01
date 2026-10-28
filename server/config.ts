import 'dotenv/config';
import path from 'node:path';

const env = process.env;

export const config = {
  env: env.NODE_ENV || 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test' || !!env.VITEST,
  port: Number(env.PORT || 3001),
  databaseFile: env.DATABASE_FILE || path.resolve('data', 'farmdirect.db'),
  uploadDir: env.UPLOAD_DIR || path.resolve('data', 'uploads'),
  // Used to sign verification codes and hash IPs. Must be set in production.
  appSecret: env.APP_SECRET || 'dev-only-insecure-secret-change-me',
  sessionDays: Number(env.SESSION_DAYS || 30),
  gemini: {
    apiKey: env.GEMINI_API_KEY && env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY' ? env.GEMINI_API_KEY : '',
    model: env.GEMINI_MODEL || 'gemini-flash-latest',
    // Used automatically when the main model is overloaded or unavailable.
    fallbackModel: env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest',
  },
  weather: {
    // Open-Meteo needs no key for non-commercial use. Set OPEN_METEO_API_KEY for the commercial endpoint.
    apiKey: env.OPEN_METEO_API_KEY || '',
    cacheMinutes: Number(env.WEATHER_CACHE_MINUTES || 30),
  },
  mandi: {
    // data.gov.in API key (free registration) for Agmarknet daily prices
    apiKey: env.DATA_GOV_IN_API_KEY || '',
    resourceId: env.AGMARKNET_RESOURCE_ID || '9ef84268-d588-465a-a308-a864a43d0070',
    cacheMinutes: Number(env.MANDI_CACHE_MINUTES || 60),
  },
  sms: {
    provider: env.SMS_PROVIDER || '', // e.g. "msg91" or "twilio"; empty = not configured
    msg91AuthKey: env.MSG91_AUTH_KEY || '',
    msg91TemplateId: env.MSG91_OTP_TEMPLATE_ID || '',
    twilioSid: env.TWILIO_ACCOUNT_SID || '',
    twilioToken: env.TWILIO_AUTH_TOKEN || '',
    twilioFrom: env.TWILIO_FROM || '',
  },
  sentinelHub: {
    clientId: env.SENTINELHUB_CLIENT_ID || '',
    clientSecret: env.SENTINELHUB_CLIENT_SECRET || '',
  },
  bootstrapAdmin: {
    phone: env.SUPER_ADMIN_PHONE || '',
    password: env.SUPER_ADMIN_PASSWORD || '',
    name: env.SUPER_ADMIN_NAME || 'Super Admin',
  },
  enableJobs: env.ENABLE_JOBS !== 'false',
  // Prototype/demo deployments: show one-time codes on screen when no SMS provider is set
  // and load demo accounts. Anyone who knows a phone number can sign in, so use test data only.
  demoMode: env.DEMO_MODE === 'on',
  // Second factor (OTP) for administrator sign-in. Only disable for isolated local development.
  adminMfa: env.ADMIN_MFA !== 'off',
  razorpay: {
    keyId: env.RAZORPAY_KEY_ID || '',
    keySecret: env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',
  },
};

export function assertProductionConfig() {
  if (config.isProd && config.appSecret.startsWith('dev-only')) {
    throw new Error('APP_SECRET must be set in production');
  }
}

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['server/tests/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test', UPLOAD_DIR: '.test-uploads', GEMINI_API_KEY: '', DATA_GOV_IN_API_KEY: '', SMS_PROVIDER: '', SENTINELHUB_CLIENT_ID: '' },
    testTimeout: 20000,
  },
});

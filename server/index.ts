import { seedDemo } from './db/demo.ts';
import { config, assertProductionConfig } from './config.ts';
import { createApp } from './app.ts';
import { q, insert } from './db/index.ts';
import { hashPassword } from './lib/security.ts';
import { id } from './lib/http.ts';
import { startJobs } from './jobs.ts';

assertProductionConfig();
const app = createApp();

// Optional bootstrap of the first super administrator from environment variables.
const b = config.bootstrapAdmin;
if (b.phone && b.password) {
  const phone = b.phone.startsWith('+91') ? b.phone : `+91${b.phone}`;
  if (!q.get('SELECT 1 FROM users WHERE phone = ?', phone)) {
    insert('users', {
      id: id(), phone, phone_verified: 1, password_hash: hashPassword(b.password), full_name: b.name, role: 'super_admin',
      onboarding_complete: 1, data_consent_at: new Date().toISOString(),
    });
    console.log(`Created super admin ${phone}`);
  }
}

if (config.demoMode) {
  seedDemo();
  console.log('Demo mode is on: one-time codes are shown on screen and demo accounts are loaded. Use test data only.');
}

if (config.enableJobs) startJobs();

app.listen(config.port, () => {
  console.log(JSON.stringify({ level: 'info', msg: `FARMDirect API listening on :${config.port}`, env: config.env }));
});

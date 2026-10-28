// Usage: npm run create-admin -- <phone> <password> "<Full Name>"
import { q, insert } from '../db/index.ts';
import { hashPassword } from '../lib/security.ts';
import { id } from '../lib/http.ts';

const [phoneArg, password, name = 'Super Admin'] = process.argv.slice(2);
if (!phoneArg || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <10-digit phone> <password (8+ chars)> "<Full Name>"');
  process.exit(1);
}
const phone = phoneArg.startsWith('+91') ? phoneArg : `+91${phoneArg}`;
const existing = q.get<{ id: string }>('SELECT id FROM users WHERE phone = ?', phone);
if (existing) {
  q.run(`UPDATE users SET role = 'super_admin', status = 'active' WHERE id = ?`, existing.id);
  console.log(`Promoted ${phone} to super_admin`);
} else {
  insert('users', {
    id: id(), phone, phone_verified: 1, password_hash: hashPassword(password), full_name: name, role: 'super_admin',
    onboarding_complete: 1, data_consent_at: new Date().toISOString(),
  });
  console.log(`Created super_admin ${phone}`);
}

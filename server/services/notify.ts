import { q, type Row } from '../db/index.ts';
import { id } from '../lib/http.ts';

/**
 * In-app notifications with de-duplication on (user_id, dedupe_key). External
 * channels (push / email / SMS) are attempted only when a provider is
 * configured AND the user opted in; otherwise the attempt is logged as
 * not_configured / skipped so delivery status is visible to admins.
 */

export type Kind = 'weather' | 'task' | 'pest' | 'price' | 'content' | 'scheme' | 'expert' | 'system' | 'order';

function inQuietHours(u: Row, now = new Date()) {
  if (!u.quiet_hours_start || !u.quiet_hours_end) return false;
  const local = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: u.timezone || 'Asia/Kolkata' }).format(now);
  const [s, e] = [u.quiet_hours_start, u.quiet_hours_end];
  return s <= e ? local >= s && local < e : local >= s || local < e;
}

export function notify(userId: string, kind: Kind, title: string, body: string, dedupeKey: string, link?: string) {
  const nid = id();
  const res = q.run(
    `INSERT OR IGNORE INTO notifications (id, user_id, kind, title, body, link, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    nid, userId, kind, title, body, link ?? null, dedupeKey,
  );
  if (res.changes === 0) return null; // duplicate suppressed

  const user = q.get<Row>('SELECT notify_channels, quiet_hours_start, quiet_hours_end, timezone FROM users WHERE id = ?', userId);
  const channels: string[] = user ? JSON.parse(user.notify_channels || '["in_app"]') : ['in_app'];
  q.run(`INSERT INTO delivery_logs (notification_id, channel, status) VALUES (?, 'in_app', 'sent')`, nid);
  for (const ch of channels.filter((c) => c !== 'in_app')) {
    if (user && inQuietHours(user)) {
      q.run(`INSERT INTO delivery_logs (notification_id, channel, status, detail) VALUES (?, ?, 'skipped', 'quiet hours')`, nid, ch);
      continue;
    }
    // No push/email/SMS provider for notifications is configured in this deployment.
    q.run(`INSERT INTO delivery_logs (notification_id, channel, status, detail) VALUES (?, ?, 'not_configured', 'provider not configured')`, nid, ch);
  }
  return nid;
}

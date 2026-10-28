import type { DatabaseSync } from 'node:sqlite';

/**
 * Ordered, append-only migrations. Each runs once inside a transaction and is
 * recorded in schema_migrations. Never edit a migration that has shipped; add
 * a new one instead. Existing records are never dropped.
 */
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '001_marketplace_trust_storage',
    sql: `
-- Account security
ALTER TABLE users ADD COLUMN failed_logins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;
ALTER TABLE users ADD COLUMN farmer_level INTEGER NOT NULL DEFAULT 1;
ALTER TABLE sessions ADD COLUMN stepup_until TEXT;
ALTER TABLE sessions ADD COLUMN mfa_verified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE platform_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Buyers
CREATE TABLE buyer_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  buyer_type TEXT NOT NULL DEFAULT 'trader',
  business_name TEXT,
  contact_email TEXT,
  address TEXT, state TEXT, district TEXT, pincode TEXT,
  operating_locations TEXT NOT NULL DEFAULT '[]',
  registration_type TEXT,
  gstin TEXT, pan TEXT, fssai TEXT, trade_license TEXT,
  commodities TEXT NOT NULL DEFAULT '[]',
  varieties TEXT, quality_grades TEXT,
  min_qty REAL, max_qty REAL, qty_unit TEXT NOT NULL DEFAULT 'quintal',
  sourcing_regions TEXT NOT NULL DEFAULT '[]',
  delivery_preference TEXT, purchase_frequency TEXT, storage_packaging_reqs TEXT,
  status TEXT NOT NULL DEFAULT 'mobile_verified',
  status_reason TEXT,
  terms_accepted_at TEXT,
  submitted_at TEXT, verified_at TEXT, verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_buyer_status ON buyer_profiles(status);
CREATE INDEX idx_buyer_gstin ON buyer_profiles(gstin);

-- Verification
CREATE TABLE verification_applications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- farmer_identity | buyer_business | storage_facility | transport_provider
  subject_id TEXT,                -- facility / transport provider id where relevant
  status TEXT NOT NULL DEFAULT 'submitted', -- submitted | under_review | info_required | approved | rejected
  submitted_data TEXT NOT NULL DEFAULT '{}',
  checks TEXT NOT NULL DEFAULT '[]',
  reviewer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_reason TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX idx_verif_status ON verification_applications(kind, status);

CREATE TABLE verification_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES verification_applications(id) ON DELETE CASCADE,
  actor_id TEXT,
  action TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  subject_type TEXT NOT NULL,     -- user | buyer | facility | transport | dispute | lot | receipt | milestone
  subject_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  file_path TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  original_name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at TEXT
);
CREATE INDEX idx_documents_subject ON documents(subject_type, subject_id);

CREATE TABLE document_access_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Fraud, reports, restrictions, appeals
CREATE TABLE fraud_flags (
  id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  rule TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  evidence TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',    -- open | dismissed | actioned
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  dedupe_key TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_at TEXT
);
CREATE INDEX idx_fraud_status ON fraud_flags(status, created_at);

CREATE TABLE user_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL,      -- user | lot | demand | facility | transport | order
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- open | investigating | actioned | dismissed
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reporter_id, target_type, target_id)
);

CREATE TABLE account_restrictions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- no_offers | no_listings | no_bookings | full
  reason TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  lifted_at TEXT,
  lifted_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE appeals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,     -- restriction | verification | dispute | fraud_flag
  subject_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | upheld | denied
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decision_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

-- Produce lots and buyer demand
CREATE TABLE produce_lots (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT REFERENCES farms(id) ON DELETE SET NULL,
  crop_id TEXT REFERENCES crops(id),
  commodity TEXT NOT NULL,
  variety TEXT,
  unit TEXT NOT NULL DEFAULT 'quintal',
  quantity_total REAL NOT NULL CHECK (quantity_total > 0),
  quantity_available REAL NOT NULL CHECK (quantity_available >= 0),
  quantity_reserved REAL NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  quantity_sold REAL NOT NULL DEFAULT 0 CHECK (quantity_sold >= 0),
  price_per_unit REAL CHECK (price_per_unit IS NULL OR price_per_unit >= 0),
  negotiable INTEGER NOT NULL DEFAULT 1,
  allow_partial INTEGER NOT NULL DEFAULT 1,
  min_order_qty REAL,
  harvest_date TEXT,
  preferred_sale_date TEXT,
  pickup_village TEXT, district TEXT, state TEXT, pincode TEXT,
  latitude REAL, longitude REAL,
  quality_grade TEXT, moisture_pct REAL, packaging TEXT, production_method TEXT,
  quality_notes TEXT, notes TEXT,
  storage_required INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT, expires_at TEXT,
  imported_from TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lots_status ON produce_lots(status, commodity, state);
CREATE INDEX idx_lots_farmer ON produce_lots(farmer_id, status);

CREATE TABLE demand_requests (
  id TEXT PRIMARY KEY,
  buyer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_id TEXT REFERENCES crops(id),
  commodity TEXT NOT NULL,
  variety TEXT,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL DEFAULT 'quintal',
  quantity_committed REAL NOT NULL DEFAULT 0,
  quality_spec TEXT,
  price_min REAL, price_max REAL,
  delivery_location TEXT, district TEXT, state TEXT, latitude REAL, longitude REAL,
  delivery_date TEXT,
  packaging TEXT, frequency TEXT, payment_terms TEXT,
  allow_aggregation INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'open', -- open | partially_filled | filled | closed | expired
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_demand_status ON demand_requests(status, commodity, state);

-- Offers & negotiation
CREATE TABLE offers (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  lot_id TEXT REFERENCES produce_lots(id) ON DELETE SET NULL,
  demand_id TEXT REFERENCES demand_requests(id) ON DELETE SET NULL,
  buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  farmer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  quantity REAL NOT NULL CHECK (quantity > 0),
  unit TEXT NOT NULL,
  price_per_unit REAL NOT NULL CHECK (price_per_unit >= 0),
  delivery_mode TEXT NOT NULL,     -- buyer_pickup | farmer_delivery | arranged_transport | from_storage
  charges TEXT NOT NULL DEFAULT '[]',
  payment_terms TEXT NOT NULL,     -- on_delivery | advance_and_balance | within_days
  advance_pct REAL, payment_due_days INTEGER,
  note TEXT,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | countered | accepted | rejected | withdrawn | expired
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at TEXT
);
CREATE INDEX idx_offers_thread ON offers(thread_id, created_at);
CREATE INDEX idx_offers_parties ON offers(buyer_id, farmer_id, status);

CREATE TABLE offer_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id TEXT NOT NULL,
  offer_id TEXT,
  actor_id TEXT,
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Orders (transaction agreements)
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  offer_id TEXT UNIQUE REFERENCES offers(id) ON DELETE SET NULL,
  lot_id TEXT REFERENCES produce_lots(id) ON DELETE SET NULL,
  demand_id TEXT REFERENCES demand_requests(id) ON DELETE SET NULL,
  farmer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  buyer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  commodity TEXT NOT NULL, variety TEXT,
  quantity REAL NOT NULL, unit TEXT NOT NULL, price_per_unit REAL NOT NULL,
  delivery_mode TEXT NOT NULL,
  pickup_location TEXT, delivery_location TEXT,
  payment_terms TEXT NOT NULL, advance_pct REAL, payment_due_days INTEGER,
  charges TEXT NOT NULL DEFAULT '[]',
  breakdown TEXT NOT NULL DEFAULT '{}',
  product_value REAL NOT NULL, buyer_payable REAL NOT NULL, farmer_net REAL NOT NULL,
  farmer_confirmed_at TEXT, buyer_confirmed_at TEXT, confirmed_at TEXT,
  reservation_expires_at TEXT,
  delivered_at TEXT, received_quantity REAL,
  inspection_status TEXT, inspection_notes TEXT,
  final_settlement REAL,
  completed_at TEXT,
  cancelled_at TEXT, cancelled_by TEXT, cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_orders_farmer ON orders(farmer_id, status);
CREATE INDEX idx_orders_buyer ON orders(buyer_id, status);

CREATE TABLE order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  lot_id TEXT REFERENCES produce_lots(id) ON DELETE SET NULL,
  commodity TEXT NOT NULL, variety TEXT,
  quantity REAL NOT NULL, unit TEXT NOT NULL, price_per_unit REAL NOT NULL, line_value REAL NOT NULL
);

CREATE TABLE order_amendments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  proposed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  changes TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);

CREATE TABLE order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id TEXT,
  event TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Storage
CREATE TABLE storage_facilities (
  id TEXT PRIMARY KEY,
  provider_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  facility_type TEXT NOT NULL,   -- warehouse | grain | general | cold_storage | pre_cooling | fpo | other
  address TEXT NOT NULL, village TEXT, district TEXT NOT NULL, state TEXT NOT NULL, pincode TEXT,
  latitude REAL NOT NULL, longitude REAL NOT NULL,
  phone TEXT,
  operating_hours TEXT,
  commodities TEXT NOT NULL DEFAULT '[]',
  temp_min_c REAL, temp_max_c REAL,
  total_capacity_qtl REAL NOT NULL CHECK (total_capacity_qtl > 0),
  min_booking_qtl REAL NOT NULL DEFAULT 1,
  loading_per_qtl REAL NOT NULL DEFAULT 0,
  unloading_per_qtl REAL NOT NULL DEFAULT 0,
  handling_per_qtl REAL NOT NULL DEFAULT 0,
  booking_fee REAL NOT NULL DEFAULT 0,
  tax_pct REAL NOT NULL DEFAULT 0,
  insurance_available INTEGER NOT NULL DEFAULT 0,
  insurance_details TEXT,
  cancellation_policy TEXT,
  booking_conditions TEXT,
  authorization_type TEXT,        -- owned | leased | authorised_operator
  license_info TEXT,
  safety_info TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | pending_review | verified | rejected | suspended
  status_reason TEXT,
  pending_changes TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_facility_status ON storage_facilities(status, state, district);

CREATE TABLE storage_rates (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES storage_facilities(id) ON DELETE CASCADE,
  commodity_category TEXT,        -- null = applies to all supported commodities
  price REAL NOT NULL CHECK (price >= 0),
  unit TEXT NOT NULL DEFAULT 'quintal', -- quintal | tonne
  period TEXT NOT NULL DEFAULT 'month',  -- day | week | month
  UNIQUE(facility_id, commodity_category, unit, period)
);

CREATE TABLE facility_blackouts (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES storage_facilities(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  capacity_reduction_qtl REAL NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE storage_bookings (
  id TEXT PRIMARY KEY,
  booking_ref TEXT NOT NULL UNIQUE,
  farmer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  facility_id TEXT NOT NULL REFERENCES storage_facilities(id),
  lot_id TEXT REFERENCES produce_lots(id) ON DELETE SET NULL,
  commodity TEXT NOT NULL,
  crop_id TEXT,
  quantity REAL NOT NULL, unit TEXT NOT NULL,
  quantity_qtl REAL NOT NULL CHECK (quantity_qtl > 0),
  start_date TEXT NOT NULL, end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'availability_requested',
  hold_expires_at TEXT,
  estimate TEXT NOT NULL DEFAULT '{}',
  provider_note TEXT,
  check_in_date TEXT,
  check_in_at TEXT, check_out_at TEXT,
  received_qty_qtl REAL,
  final_charges TEXT,
  cancel_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bookings_facility ON storage_bookings(facility_id, status, start_date, end_date);
CREATE INDEX idx_bookings_farmer ON storage_bookings(farmer_id, status);

CREATE TABLE storage_receipts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL UNIQUE REFERENCES storage_bookings(id) ON DELETE CASCADE,
  receipt_no TEXT NOT NULL UNIQUE,
  received_qty_qtl REAL NOT NULL,
  condition_notes TEXT NOT NULL,
  moisture_pct REAL,
  quality_notes TEXT,
  bin_ref TEXT,
  expected_release_date TEXT,
  issued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  issued_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id TEXT NOT NULL REFERENCES storage_bookings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,             -- in | out | adjust | condition | status
  quantity_qtl REAL,
  note TEXT,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE storage_enquiries (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES storage_facilities(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  replied_at TEXT
);

CREATE TABLE facility_incidents (
  id TEXT PRIMARY KEY,
  facility_id TEXT NOT NULL REFERENCES storage_facilities(id) ON DELETE CASCADE,
  reported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  description TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Transport
CREATE TABLE transport_providers (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  vehicle_types TEXT NOT NULL DEFAULT '[]',
  capacity_tonnes REAL,
  service_states TEXT NOT NULL DEFAULT '[]',
  service_districts TEXT NOT NULL DEFAULT '[]',
  rate_per_km REAL, min_charge REAL,
  license_info TEXT,
  status TEXT NOT NULL DEFAULT 'pending_review', -- pending_review | verified | rejected | suspended
  status_reason TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transport_requests (
  id TEXT PRIMARY KEY,
  requester_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES storage_bookings(id) ON DELETE SET NULL,
  pickup_address TEXT NOT NULL, pickup_lat REAL, pickup_lon REAL,
  drop_address TEXT NOT NULL, drop_lat REAL, drop_lon REAL,
  distance_km REAL,
  quantity_qtl REAL NOT NULL,
  packaging TEXT,
  preferred_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested', -- requested | quoted | accepted | picked_up | in_transit | delivered | exception | cancelled
  accepted_quote_id TEXT,
  cost REAL,
  payer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE transport_quotes (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES transport_providers(id) ON DELETE CASCADE,
  amount REAL NOT NULL CHECK (amount >= 0),
  eta_date TEXT,
  note TEXT,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'offered', -- offered | accepted | declined | expired
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, provider_id)
);

CREATE TABLE transport_milestones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id TEXT NOT NULL REFERENCES transport_requests(id) ON DELETE CASCADE,
  event TEXT NOT NULL,            -- scheduled | picked_up | in_transit | delivered | exception | damage
  note TEXT,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Payments
CREATE TABLE payment_records (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES storage_bookings(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,             -- advance | balance | full | storage_fee | refund | settlement
  payer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  payee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  amount REAL NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'required',
  method TEXT,                    -- gateway | offline_recorded
  provider TEXT,
  provider_order_id TEXT,
  provider_payment_id TEXT UNIQUE,
  reference_note TEXT,
  due_date TEXT,
  paid_at TEXT,
  confirmed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_payments_order ON payment_records(order_id);
CREATE INDEX idx_payments_booking ON payment_records(booking_id);

CREATE TABLE payment_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id TEXT,
  provider_event_id TEXT UNIQUE,
  event TEXT NOT NULL,
  actor_id TEXT,
  payload TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Disputes
CREATE TABLE disputes (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  booking_id TEXT REFERENCES storage_bookings(id) ON DELETE SET NULL,
  raised_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  against_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  requested_resolution TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | under_review | awaiting_evidence | escalated | resolved | rejected | appealed
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  resolution TEXT,
  decided_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  decided_at TEXT,
  appeal_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_disputes_status ON disputes(status, created_at);

CREATE TABLE dispute_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dispute_id TEXT NOT NULL REFERENCES disputes(id),
  actor_id TEXT,
  kind TEXT NOT NULL,             -- created | status | comment | evidence | internal_note | assignment | decision | appeal
  body TEXT NOT NULL,
  internal INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Material decision records cannot be altered or removed.
CREATE TRIGGER dispute_events_no_update BEFORE UPDATE ON dispute_events BEGIN SELECT RAISE(ABORT, 'dispute_events is append-only'); END;
CREATE TRIGGER dispute_events_no_delete BEFORE DELETE ON dispute_events BEGIN SELECT RAISE(ABORT, 'dispute_events is append-only'); END;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
CREATE TRIGGER audit_logs_no_delete BEFORE DELETE ON audit_logs BEGIN SELECT RAISE(ABORT, 'audit_logs is append-only'); END;
`,
  },
  {
    id: '002_grading_guides_statistics_directory_inputs',
    sql: `
-- Brand text stored in earlier seed data
UPDATE advisories SET source_name = REPLACE(source_name, 'FarmDirect', 'FARMDirect') WHERE source_name LIKE '%FarmDirect%';

-- Crop quality grading (manual, evidence-based inspection; not official certification)
CREATE TABLE grading_requests (
  id TEXT PRIMARY KEY,
  lot_id TEXT NOT NULL REFERENCES produce_lots(id) ON DELETE CASCADE,
  farmer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested', -- requested | assigned | graded | review_requested | cancelled
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  review_reason TEXT,
  review_requested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_grading_status ON grading_requests(status, created_at);
CREATE INDEX idx_grading_lot ON grading_requests(lot_id);

CREATE TABLE grading_results (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES grading_requests(id) ON DELETE CASCADE,
  lot_id TEXT NOT NULL REFERENCES produce_lots(id) ON DELETE CASCADE,
  inspector_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  version INTEGER NOT NULL,
  grade TEXT NOT NULL,
  measurements TEXT NOT NULL DEFAULT '{}',
  reasons TEXT NOT NULL,
  quantity_inspected REAL,
  sample_method TEXT,
  inspected_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(request_id, version)
);

-- Crop / pest / disease field guide
CREATE TABLE field_guides (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,         -- crop | pest | disease | deficiency | weed
  name TEXT NOT NULL,
  scientific_name TEXT,
  local_names TEXT NOT NULL DEFAULT '{}',
  crops TEXT NOT NULL DEFAULT '[]',
  symptoms TEXT NOT NULL,
  identification TEXT,
  management TEXT NOT NULL,
  seek_help TEXT,
  image_url TEXT, image_license TEXT, image_credit TEXT,
  source_name TEXT, source_url TEXT,
  review_status TEXT NOT NULL DEFAULT 'needs_review',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(category, name)
);

-- Official crop statistics imported by administrators from published sources
CREATE TABLE crop_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop TEXT NOT NULL, state TEXT NOT NULL, district TEXT NOT NULL DEFAULT '',
  season TEXT NOT NULL DEFAULT '', year TEXT NOT NULL,
  metric TEXT NOT NULL,           -- area | production | yield
  value REAL NOT NULL, unit TEXT NOT NULL,
  data_status TEXT NOT NULL DEFAULT 'official', -- official | provisional | advance_estimate
  source_name TEXT NOT NULL, source_url TEXT NOT NULL, publication_date TEXT,
  retrieved_at TEXT NOT NULL,
  import_batch TEXT NOT NULL,
  imported_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(crop, state, district, season, year, metric, source_name)
);
CREATE INDEX idx_stats_lookup ON crop_statistics(crop, state, year);

-- Farmer ↔ buyer enquiries from the business directory
CREATE TABLE business_enquiries (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lot_id TEXT REFERENCES produce_lots(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  share_phone INTEGER NOT NULL DEFAULT 0,
  reply TEXT,
  status TEXT NOT NULL DEFAULT 'open',  -- open | replied | closed
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  replied_at TEXT
);
CREATE INDEX idx_enquiries_to ON business_enquiries(to_user, status);

-- Farm input sales by verified dealers
CREATE TABLE input_offers (
  id TEXT PRIMARY KEY,
  dealer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pack_size TEXT NOT NULL,
  price_inr REAL NOT NULL CHECK (price_inr >= 0),
  stock INTEGER NOT NULL CHECK (stock >= 0),
  state TEXT NOT NULL, district TEXT NOT NULL,
  pickup_address TEXT,
  delivery_available INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active', -- active | paused
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(dealer_id, product_id, pack_size)
);

CREATE TABLE input_orders (
  id TEXT PRIMARY KEY,
  ref TEXT NOT NULL UNIQUE,
  offer_id TEXT REFERENCES input_offers(id) ON DELETE SET NULL,
  farmer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  dealer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL, pack_size TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL, total REAL NOT NULL,
  fulfilment TEXT NOT NULL DEFAULT 'pickup', -- pickup | delivery
  status TEXT NOT NULL DEFAULT 'requested', -- requested | confirmed | ready | fulfilled | rejected | cancelled
  note TEXT, dealer_note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_input_orders ON input_orders(farmer_id, dealer_id, status);

ALTER TABLE payment_records ADD COLUMN input_order_id TEXT REFERENCES input_orders(id) ON DELETE SET NULL;
`,
  },
  {
    id: '003_medha_actions',
    sql: `ALTER TABLE messages ADD COLUMN actions TEXT NOT NULL DEFAULT '[]';`,
  },
];

export function runMigrations(db: DatabaseSync) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`);
  const applied = new Set((db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue;
    db.exec('BEGIN');
    try {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw new Error(`Migration ${m.id} failed: ${(e as Error).message}`);
    }
  }
}

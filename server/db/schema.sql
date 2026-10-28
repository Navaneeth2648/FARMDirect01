-- FARMDirect platform schema (SQLite dialect; kept portable to Postgres).
-- Each migration block is applied once; see server/db/index.ts.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  phone_verified INTEGER NOT NULL DEFAULT 0,
  email TEXT,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'farmer',
  -- non-farmer professional roles must be verified by an administrator
  verification_status TEXT NOT NULL DEFAULT 'not_required',
  status TEXT NOT NULL DEFAULT 'active', -- active | suspended | deleted
  language TEXT NOT NULL DEFAULT 'en',
  state TEXT, district TEXT, subdistrict TEXT, village TEXT, pincode TEXT,
  latitude REAL, longitude REAL,
  location_consent INTEGER NOT NULL DEFAULT 0,
  data_consent_at TEXT,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  notify_channels TEXT NOT NULL DEFAULT '["in_app"]',
  quiet_hours_start TEXT, quiet_hours_end TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  keep_diagnosis_history INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS otp_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  purpose TEXT NOT NULL, -- verify | reset | login
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone, purpose);

CREATE TABLE IF NOT EXISTS farms (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  state TEXT, district TEXT, subdistrict TEXT, village TEXT, pincode TEXT,
  latitude REAL, longitude REAL,
  total_area REAL, area_unit TEXT NOT NULL DEFAULT 'acre',
  ownership TEXT, -- owned | leased | shared | other
  irrigation_method TEXT,
  water_source TEXT,
  soil_type TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS plots (
  id TEXT PRIMARY KEY,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  area REAL, area_unit TEXT NOT NULL DEFAULT 'acre',
  boundary_geojson TEXT,
  soil_type TEXT,
  irrigation_method TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(farm_id, name)
);

CREATE TABLE IF NOT EXISTS crops (
  id TEXT PRIMARY KEY,           -- slug, e.g. paddy
  name TEXT NOT NULL,
  local_names TEXT NOT NULL DEFAULT '{}', -- {"hi": "...", "te": "..."}
  category TEXT NOT NULL,        -- cereal | pulse | oilseed | vegetable | fruit | cash | spice
  seasons TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]', -- states where coverage is configured; [] = not yet configured
  agmarknet_name TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS crop_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  start_day INTEGER NOT NULL,  -- days relative to sowing (negative = before sowing)
  end_day INTEGER NOT NULL,
  water_need TEXT NOT NULL DEFAULT 'medium', -- low | medium | high | critical
  UNIQUE(crop_id, key)
);

CREATE TABLE IF NOT EXISTS advisories (
  id TEXT PRIMARY KEY,
  crop_id TEXT REFERENCES crops(id) ON DELETE CASCADE,
  stage_key TEXT,
  topic TEXT NOT NULL, -- irrigation | nutrient | weed | pest | disease | harvest | general ...
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  region TEXT,          -- null = general guidance
  language TEXT NOT NULL DEFAULT 'en',
  source_name TEXT,
  source_url TEXT,
  review_status TEXT NOT NULL DEFAULT 'needs_review', -- needs_review | approved | rejected
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_advisories_crop ON advisories(crop_id, stage_key);

CREATE TABLE IF NOT EXISTS crop_cycles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
  crop_id TEXT NOT NULL REFERENCES crops(id),
  variety TEXT,
  season TEXT,
  sowing_date TEXT NOT NULL,
  expected_harvest_date TEXT,
  actual_harvest_date TEXT,
  area REAL, area_unit TEXT NOT NULL DEFAULT 'acre',
  status TEXT NOT NULL DEFAULT 'active', -- planned | active | harvested | abandoned
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cycles_user ON crop_cycles(user_id, status);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE CASCADE,
  farm_id TEXT REFERENCES farms(id) ON DELETE CASCADE,
  template_key TEXT, -- set for auto-generated tasks; unique per cycle (prevents duplicates)
  category TEXT NOT NULL DEFAULT 'custom', -- irrigation | fertilizer | scouting | sowing | harvest | custom ...
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT NOT NULL,
  repeat_days INTEGER,
  weather_sensitive INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | done | skipped
  completed_at TEXT,
  user_modified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(crop_cycle_id, template_key)
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_due ON tasks(user_id, status, due_date);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT REFERENCES farms(id) ON DELETE CASCADE,
  plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
  crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL, -- input_application | scouting | labor | equipment | irrigation | other
  date TEXT NOT NULL,
  details TEXT NOT NULL,
  quantity REAL, unit TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS soil_tests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
  sample_date TEXT NOT NULL,
  lab_name TEXT,
  ph REAL, ec REAL, organic_carbon REAL,
  nitrogen REAL, phosphorus REAL, potassium REAL, -- kg/ha
  sulphur REAL, zinc REAL, iron REAL, boron REAL, -- ppm
  texture TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS irrigation_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  plot_id TEXT REFERENCES plots(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  method TEXT,
  duration_hours REAL,
  water_mm REAL,
  waterlogging_observed INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
  category TEXT NOT NULL, -- seeds | fertilizer | crop_protection | labor | irrigation | equipment | transport | other
  amount_inr REAL NOT NULL CHECK (amount_inr >= 0),
  is_estimate INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS harvests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
  crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  quantity REAL NOT NULL CHECK (quantity >= 0),
  unit TEXT NOT NULL DEFAULT 'quintal',
  sold_quantity REAL,
  price_per_unit_inr REAL,
  is_estimate INTEGER NOT NULL DEFAULT 0,
  buyer TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS weather_cache (
  cache_key TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS market_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  state TEXT NOT NULL, district TEXT, market TEXT NOT NULL,
  commodity TEXT NOT NULL, variety TEXT, grade TEXT,
  arrival_date TEXT NOT NULL, -- ISO yyyy-mm-dd
  min_price REAL, max_price REAL, modal_price REAL,
  unit TEXT NOT NULL DEFAULT 'INR/quintal',
  fetched_at TEXT NOT NULL,
  UNIQUE(source, state, market, commodity, variety, grade, arrival_date)
);
CREATE INDEX IF NOT EXISTS idx_prices_lookup ON market_prices(commodity, state, district, arrival_date);

CREATE TABLE IF NOT EXISTS market_watchlist (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  commodity TEXT NOT NULL,
  state TEXT, district TEXT, market TEXT,
  alert_change_pct REAL,
  last_notified_price REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, commodity, state, district, market)
);

CREATE TABLE IF NOT EXISTS market_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  price_id INTEGER REFERENCES market_prices(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS diagnoses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  farm_id TEXT REFERENCES farms(id) ON DELETE SET NULL,
  crop_cycle_id TEXT REFERENCES crop_cycles(id) ON DELETE SET NULL,
  crop_id TEXT,
  plant_part TEXT, growth_stage TEXT, symptoms TEXT,
  image_path TEXT,          -- relative to UPLOAD_DIR; null after deletion
  image_mime TEXT,
  status TEXT NOT NULL DEFAULT 'processing', -- processing | completed | needs_better_image | failed | not_configured
  result_json TEXT,
  confidence REAL,
  model TEXT,
  error TEXT,
  expert_status TEXT, -- requested | confirmed | corrected
  expert_notes TEXT,
  expert_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  saved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_diagnoses_user ON diagnoses(user_id, created_at);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  farm_id TEXT REFERENCES farms(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL, -- user | assistant
  content TEXT NOT NULL,
  sources TEXT NOT NULL DEFAULT '[]',
  escalate INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL, -- pest | disease | heavy_rain | flood | drought | heat | wind | cold | other
  severity TEXT NOT NULL, -- info | advisory | warning | severe
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  precautions TEXT,
  state TEXT, district TEXT,
  latitude REAL, longitude REAL, radius_km REAL,
  crop_id TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  dedupe_key TEXT UNIQUE,
  starts_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, -- set for farm-specific (forecast-derived) alerts
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_alerts_region ON alerts(state, district, expires_at);

CREATE TABLE IF NOT EXISTS alert_reads (
  alert_id TEXT NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (alert_id, user_id)
);

CREATE TABLE IF NOT EXISTS alert_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT, district TEXT, crop_id TEXT,
  UNIQUE(user_id, state, district, crop_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, -- weather | task | pest | price | content | scheme | expert | system
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  dedupe_key TEXT NOT NULL,
  read_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS delivery_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT REFERENCES notifications(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL, -- sent | skipped | failed | not_configured
  attempts INTEGER NOT NULL DEFAULT 1,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- article | guide | video | audio | infographic | news | event | success_story
  title TEXT NOT NULL,
  summary TEXT,
  body TEXT,
  media_url TEXT,
  transcript TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  crop_ids TEXT NOT NULL DEFAULT '[]',
  regions TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  event_date TEXT, event_location TEXT,
  source_name TEXT, source_url TEXT, license TEXT,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | in_review | published | archived
  safety_critical INTEGER NOT NULL DEFAULT 0,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status, type, published_at);

CREATE TABLE IF NOT EXISTS content_feedback (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  helpful INTEGER NOT NULL,
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(content_id, user_id)
);

CREATE TABLE IF NOT EXISTS saved_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL, -- content | advisory | diagnosis | scheme | product | market
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS recent_views (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  title TEXT NOT NULL,
  viewed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS schemes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  level TEXT NOT NULL, -- central | state
  state TEXT,
  scheme_type TEXT NOT NULL, -- income_support | insurance | credit | irrigation | soil | market | subsidy | other
  farmer_categories TEXT NOT NULL DEFAULT '[]',
  crop_ids TEXT NOT NULL DEFAULT '[]',
  eligibility TEXT NOT NULL,
  benefits TEXT NOT NULL,
  documents TEXT,
  process TEXT,
  deadline TEXT,
  official_url TEXT NOT NULL,
  last_verified_at TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category TEXT NOT NULL, -- seeds | fertilizer | crop_protection | biological | soil_health | irrigation | machinery | other
  registration_no TEXT,
  registered_uses TEXT,
  crop_ids TEXT NOT NULL DEFAULT '[]',
  label_info TEXT,
  safety TEXT,
  pack_sizes TEXT,
  documentation_url TEXT,
  image_url TEXT,
  data_source TEXT NOT NULL, -- who supplied/authorised the record
  status TEXT NOT NULL DEFAULT 'draft', -- draft | published | withdrawn
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_dealers (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  provider_id TEXT NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  PRIMARY KEY (product_id, provider_id)
);

CREATE TABLE IF NOT EXISTS verification_batches (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  mfg_date TEXT, expiry_date TEXT,
  issued_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  issuer_name TEXT NOT NULL,
  code_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, batch_no)
);

CREATE TABLE IF NOT EXISTS verification_codes (
  code_hash TEXT PRIMARY KEY, -- HMAC; raw codes are never stored
  batch_id TEXT NOT NULL REFERENCES verification_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- active | revoked
  first_verified_at TEXT,
  verify_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verification_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  ip_hash TEXT,
  code_hash TEXT,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suspicious_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  code_text TEXT,
  product_name TEXT,
  where_bought TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS service_providers (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL, -- agronomist | soil_lab | input_dealer | irrigation | equipment_rental | custom_hiring | drone | training
  description TEXT,
  phone TEXT, email TEXT, website TEXT,
  address TEXT, state TEXT, district TEXT, pincode TEXT,
  latitude REAL, longitude REAL,
  availability TEXT,
  license_no TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending', -- pending | verified | rejected
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_requests (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  share_phone INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expert_cases (
  id TEXT PRIMARY KEY,
  farmer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  diagnosis_id TEXT REFERENCES diagnoses(id) ON DELETE SET NULL,
  farm_id TEXT REFERENCES farms(id) ON DELETE SET NULL,
  crop_id TEXT,
  question TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal', -- normal | urgent
  status TEXT NOT NULL DEFAULT 'open', -- open | assigned | answered | closed | escalated
  assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
  allow_contact INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_cases_status ON expert_cases(status, urgency);

CREATE TABLE IF NOT EXISTS case_events (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES expert_cases(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL, -- reply | field_visit | observation | follow_up | status
  body TEXT NOT NULL,
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS community_posts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- question | experience | discussion
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  crop_id TEXT,
  status TEXT NOT NULL DEFAULT 'visible', -- visible | pending | hidden
  expert_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON community_posts(status, created_at);

CREATE TABLE IF NOT EXISTS community_comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  is_expert INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'visible',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL, -- post | comment | content | provider
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open | actioned | dismissed
  resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(reporter_id, target_type, target_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  detail TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

CREATE TABLE IF NOT EXISTS api_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  operation TEXT NOT NULL,
  ok INTEGER NOT NULL,
  latency_ms INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_api_events ON api_events(provider, created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  module TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

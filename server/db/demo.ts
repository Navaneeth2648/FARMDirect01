import { q, insert, type Row } from './index.ts';
import { hashPassword } from '../lib/security.ts';
import { id } from '../lib/http.ts';

/**
 * Demo accounts and sample marketplace content for prototype deployments
 * (DEMO_MODE=on). Hosts without a persistent disk start with an empty database,
 * so this runs on every start and only adds what is missing. All records are
 * clearly test data; never enable DEMO_MODE with real users.
 */
export const DEMO_ACCOUNTS = [
  { phone: '+919000000001', password: 'devfarmer123', role: 'farmer', name: 'Ravi (demo farmer)' },
  { phone: '+919000000031', password: 'devbuyer123', role: 'buyer', name: 'Lakshmi (demo buyer)' },
  { phone: '+919000000041', password: 'devstorage123', role: 'storage_provider', name: 'Suresh (demo storage)' },
  { phone: '+919000000009', password: 'devadmin12345', role: 'super_admin', name: 'Demo Admin' },
] as const;

const LOC = { state: 'Telangana', district: 'Warangal', village: 'Hanamkonda', pincode: '506001', latitude: 17.98, longitude: 79.6 };
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

function ensureUser(a: (typeof DEMO_ACCOUNTS)[number]) {
  const found = q.get<Row>('SELECT id FROM users WHERE phone = ?', a.phone);
  if (found) return { id: found.id as string, created: false };
  const uid = id();
  insert('users', {
    id: uid, phone: a.phone, phone_verified: 1, password_hash: hashPassword(a.password), full_name: a.name, role: a.role,
    ...LOC, location_consent: 1, onboarding_complete: 1, data_consent_at: new Date().toISOString(),
    farmer_level: a.role === 'farmer' ? 2 : 1,
  });
  return { id: uid, created: true };
}

export function seedDemo() {
  const [farmer, buyer, storage, admin] = DEMO_ACCOUNTS.map(ensureUser);
  q.tx(() => {
    if (farmer.created) {
      const farmId = id();
      insert('farms', { id: farmId, user_id: farmer.id, name: 'Demo farm', ...LOC, total_area: 5, irrigation_method: 'drip', water_source: 'borewell', soil_type: 'black' });
      const plotId = id();
      insert('plots', {
        id: plotId, farm_id: farmId, name: 'Plot A', area: 2,
        boundary_geojson: JSON.stringify({ type: 'Polygon', coordinates: [[[79.5808, 18.0017], [79.5838, 18.0017], [79.5838, 18.0042], [79.5808, 18.0042], [79.5808, 18.0017]]] }),
      });
      insert('crop_cycles', { id: id(), user_id: farmer.id, farm_id: farmId, plot_id: plotId, crop_id: 'chilli', variety: 'Teja', season: 'kharif', sowing_date: day(-75), area: 2 });
      for (const lot of [
        { crop_id: 'chilli', commodity: 'Dry Chillies', variety: 'Teja', qty: 20, price: 14000, grade: 'A' },
        { crop_id: 'maize', commodity: 'Maize', variety: 'Hybrid', qty: 50, price: 2100, grade: 'FAQ' },
      ]) {
        insert('produce_lots', {
          id: id(), farmer_id: farmer.id, farm_id: farmId, crop_id: lot.crop_id, commodity: lot.commodity, variety: lot.variety, unit: 'quintal',
          quantity_total: lot.qty, quantity_available: lot.qty, price_per_unit: lot.price, harvest_date: day(-5), quality_grade: lot.grade,
          pickup_village: LOC.village, district: LOC.district, state: LOC.state, pincode: LOC.pincode, latitude: LOC.latitude, longitude: LOC.longitude,
          status: 'published', published_at: new Date().toISOString(), expires_at: day(30), notes: 'Demo listing (test data).',
        });
      }
    }
    if (buyer.created) {
      insert('buyer_profiles', {
        user_id: buyer.id, buyer_type: 'trader', business_name: 'Demo Traders (test)', address: 'Market Yard, Warangal', ...{ state: LOC.state, district: LOC.district },
        commodities: ['Dry Chillies', 'Maize'], sourcing_regions: ['Telangana'], min_qty: 10, max_qty: 200, purchase_frequency: 'weekly',
        status: 'verified', terms_accepted_at: new Date().toISOString(), submitted_at: new Date().toISOString(), verified_at: new Date().toISOString(), verified_by: admin.id,
      });
      insert('demand_requests', {
        id: id(), buyer_id: buyer.id, crop_id: 'chilli', commodity: 'Dry Chillies', quantity: 30, unit: 'quintal', price_min: 13000, price_max: 15000,
        delivery_location: 'Warangal', district: LOC.district, state: LOC.state, latitude: LOC.latitude, longitude: LOC.longitude,
        delivery_date: day(14), payment_terms: 'on_delivery', expires_at: day(21),
      });
    }
    if (storage.created) {
      const facilityId = id();
      insert('storage_facilities', {
        id: facilityId, provider_id: storage.id, name: 'Demo Cold Storage (test)', operator_name: 'Suresh', facility_type: 'cold_storage',
        address: 'Kazipet Road, Warangal', village: 'Kazipet', district: LOC.district, state: LOC.state, pincode: '506003', latitude: 17.99, longitude: 79.53,
        commodities: ['Dry Chillies', 'Turmeric', 'Onion'], temp_min_c: 2, temp_max_c: 8, total_capacity_qtl: 2000, min_booking_qtl: 5,
        loading_per_qtl: 10, unloading_per_qtl: 10, handling_per_qtl: 5, cancellation_policy: 'Free cancellation up to 24 hours before check-in.',
        status: 'verified', verified_by: admin.id, verified_at: new Date().toISOString(),
      });
      insert('storage_rates', { id: id(), facility_id: facilityId, commodity_category: null, price: 120, unit: 'quintal', period: 'month' });
    }
  });
}

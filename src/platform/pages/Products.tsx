import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, Package, Search } from 'lucide-react';
import { api, qs } from '../api';
import { Badge, Button, Empty, ErrorBox, Input, Notice, PageHeader, Section, Select, Skeleton, useAsync, useToast } from '../ui';
import { CropSelect, useCropName } from '../shared';

const CATS = ['seeds', 'fertilizer', 'crop_protection', 'biological', 'soil_health', 'irrigation', 'machinery', 'tools', 'other'];

export function ProductsPage() {
  const [f, setF] = useState({ category: '', crop: '', q: '' });
  const [query, setQuery] = useState(f);
  const res = useAsync(() => api.get(`/v1/products${qs(query)}`), [query]);
  return (
    <div className="space-y-4">
      <PageHeader title="Agricultural Products" icon={<Package />} subtitle="Information from manufacturer-authorised records. This catalogue is informational; online ordering is not enabled." />
      {res.data && <Notice tone="warn">{res.data.disclaimer}</Notice>}
      <Section>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setQuery(f); }}>
          <Input aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Product or manufacturer" />
          <Select aria-label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="All categories" options={CATS.map((c) => ({ value: c, label: c.replace('_', ' ') }))} />
          <CropSelect value={f.crop} onChange={(v) => setF({ ...f, crop: v })} />
          <Button type="submit"><Search className="mr-1 h-4 w-4" />Search</Button>
        </form>
      </Section>
      {res.loading ? <Skeleton /> : res.error ? <ErrorBox error={res.error} /> : res.data.products.length === 0 ? (
        <Empty title="No products listed yet" icon={<Package className="h-8 w-8" />}>Products appear here only after an administrator adds records supplied or authorised by the manufacturer. We do not list unverified products.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {res.data.products.map((p: any) => (
            <Link key={p.id} to={`/products/${p.id}`} className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400">
              {p.image_url && <img src={p.image_url} alt="" loading="lazy" className="mb-2 h-32 w-full rounded-lg object-contain" />}
              <p className="font-semibold">{p.name}</p>
              <p className="text-sm text-gray-600">{p.manufacturer}</p>
              <div className="mt-2 flex flex-wrap gap-1"><Badge>{p.category.replace('_', ' ')}</Badge>{p.pack_sizes && <Badge tone="blue">{p.pack_sizes}</Badge>}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const cropName = useCropName();
  const r = useAsync(() => api.get(`/v1/products/${id}`), [id]);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const p = r.data.product;
  const row = (label: string, v?: string | null) => v && <div><dt className="text-xs font-semibold uppercase text-gray-500">{label}</dt><dd className="whitespace-pre-wrap text-sm text-gray-800">{v}</dd></div>;
  return (
    <div className="space-y-4">
      <PageHeader title={p.name} subtitle={p.manufacturer} icon={<Package />}
        actions={<Button variant="outline" onClick={async () => { await api.post('/v1/me/saved', { item_type: 'product', item_id: p.id, title: p.name }); toast('Saved'); }}><Bookmark className="mr-1 h-4 w-4" />Save</Button>} />
      <Notice tone="warn">Listing is not a recommendation. Use only for registered crops and uses, follow the label, and wear protective equipment where instructed.</Notice>
      <div className="grid gap-4 lg:grid-cols-3">
        <Section className="lg:col-span-2">
          <dl className="space-y-3">
            {row('Category', p.category.replace('_', ' '))}
            {row('Registration number', p.registration_no)}
            {row('Registered uses', p.registered_uses)}
            {p.crop_ids.length > 0 && row('Crops on label', p.crop_ids.map((c: string) => cropName(c)).join(', '))}
            {row('Label information', p.label_info)}
            {row('Safety precautions', p.safety)}
            {row('Pack sizes', p.pack_sizes)}
          </dl>
          {p.documentation_url && <a className="mt-3 inline-block text-sm text-emerald-700 underline" href={p.documentation_url} target="_blank" rel="noreferrer">Official product documentation</a>}
          <p className="mt-3 text-xs text-gray-500">Data source: {p.data_source}</p>
        </Section>
        <Section title="Verified dealers">
          {r.data.dealers.length === 0 ? <p className="text-sm text-gray-500">No verified dealers linked yet.</p> : (
            <ul className="space-y-2 text-sm">{r.data.dealers.map((d: any) => <li key={d.id}><p className="font-medium">{d.name}</p><p className="text-xs text-gray-500">{d.district}, {d.state} {d.phone && `· ${d.phone}`}</p></li>)}</ul>
          )}
          <Link to="/verify" className="mt-3 inline-block text-sm text-emerald-700 underline">Verify a pack you bought</Link>
        </Section>
      </div>
    </div>
  );
}

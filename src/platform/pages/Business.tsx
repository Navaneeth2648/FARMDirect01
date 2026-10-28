import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, ShieldCheck, ShoppingCart } from 'lucide-react';
import { api, fmtDate, fmtDateTime, inr, qs } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, Modal, Notice, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useConfirm, useToast } from '../ui';
import { StatusBadge } from '../trade-ui';

const list = (v: any) => (Array.isArray(v) ? v.join(', ') : v || '—');

// ---------------- Buyers & businesses ----------------
export function BusinessesPage() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const tab = (sp.get('tab') as 'directory' | 'enquiries') || 'directory';
  const [f, setF] = useState({ commodity: '', state: user?.state ?? '', type: '' });
  const r = useAsync(() => api.get(`/v1/businesses${qs({ commodity: f.commodity || undefined, state: f.state || undefined, type: f.type || undefined })}`), [f.commodity, f.state, f.type]);
  const [contact, setContact] = useState<any>(null);
  const canContact = user?.role === 'farmer' || user?.role === 'fpo_manager';
  return (
    <div className="space-y-4">
      <PageHeader title="Buyers & Businesses" icon={<Building2 />} subtitle="Businesses that FARMDirect reviewers have verified. Contact details stay private until you trade or a buyer chooses to share them." />
      <Tabs value={tab} onChange={(v) => setSp({ tab: v })} tabs={[{ id: 'directory', label: 'Verified buyers' }, { id: 'enquiries', label: 'My enquiries' }]} />
      {tab === 'enquiries' ? <Enquiries /> : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Input placeholder="Commodity, e.g. Maize" value={f.commodity} onChange={(e) => setF({ ...f, commodity: e.target.value })} aria-label="Commodity" />
            <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} placeholder="All states" options={INDIAN_STATES} />
            <Select aria-label="Business type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="All types" options={['trader', 'processor', 'exporter', 'retailer', 'wholesaler', 'fpo', 'institution', 'other'].map((v) => ({ value: v, label: v }))} />
          </div>
          {r.loading ? <Skeleton lines={5} /> : r.error ? <ErrorBox error={r.error} onRetry={r.reload} /> : !r.data.buyers.length ? (
            <Empty title="No verified buyers match" icon={<Building2 />}>Try another commodity or state. Only businesses that passed verification are listed.</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {r.data.buyers.map((b: any) => (
                <div key={b.user_id} className="rounded-2xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{b.business_name || 'Verified buyer'}</p>
                      <p className="text-xs text-gray-500">{b.buyer_type} · {[b.district, b.state].filter(Boolean).join(', ')}</p>
                    </div>
                    <Badge tone="green"><ShieldCheck className="mr-1 inline h-3 w-3" />Verified {fmtDate(b.verified_at)}</Badge>
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
                    <dt className="text-gray-500">Buys</dt><dd>{list(b.commodities)}</dd>
                    <dt className="text-gray-500">Sources from</dt><dd>{list(b.sourcing_regions)}</dd>
                    <dt className="text-gray-500">Typical quantity</dt><dd>{b.min_qty || b.max_qty ? `${b.min_qty ?? '?'}–${b.max_qty ?? '?'} ${b.qty_unit}` : '—'}</dd>
                    <dt className="text-gray-500">Frequency</dt><dd>{b.purchase_frequency || '—'}</dd>
                    <dt className="text-gray-500">Open requirements</dt><dd>{b.open_requirements}</dd>
                    <dt className="text-gray-500">Completed orders on FARMDirect</dt><dd>{b.completed_orders}</dd>
                  </dl>
                  {canContact && <div className="mt-3 flex gap-2"><Button size="sm" onClick={() => setContact(b)}>Send enquiry</Button><Link to="/market?tab=demand"><Button size="sm" variant="outline">See requirements</Button></Link></div>}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">{r.data?.note}</p>
        </>
      )}
      {contact && <EnquiryModal buyer={contact} onClose={() => setContact(null)} />}
    </div>
  );
}

function EnquiryModal({ buyer, onClose }: { buyer: any; onClose: () => void }) {
  const toast = useToast();
  const lots = useAsync(() => api.get('/v1/marketplace/lots/mine'));
  const [m, setM] = useState({ message: '', lot_id: '', share_phone: false });
  const [busy, setBusy] = useState(false);
  return (
    <Modal open onClose={onClose} title={`Enquiry to ${buyer.business_name || 'verified buyer'}`}>
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        try { await api.post(`/v1/businesses/${buyer.user_id}/enquiries`, { message: m.message, lot_id: m.lot_id || null, share_phone: m.share_phone }); toast('Enquiry sent. You will be notified when the buyer replies.'); onClose(); }
        catch (err: any) { toast(err.message, 'error'); } finally { setBusy(false); }
      }}>
        <Field label="Message" required>{(id) => <Textarea id={id} value={m.message} onChange={(e) => setM({ ...m, message: e.target.value })} placeholder="What you have, how much, and when it is ready" />}</Field>
        {lots.data?.lots?.length > 0 && (
          <Field label="Attach one of your lots (optional)">{(id) => <Select id={id} value={m.lot_id} onChange={(e) => setM({ ...m, lot_id: e.target.value })} placeholder="None" options={lots.data.lots.map((l: any) => ({ value: l.id, label: `${l.commodity} · ${l.quantity_available} ${l.unit}` }))} />}</Field>
        )}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={m.share_phone} onChange={(e) => setM({ ...m, share_phone: e.target.checked })} />Share my phone number with this buyer</label>
        <Button type="submit" disabled={busy || !m.message.trim()}>Send enquiry</Button>
      </form>
    </Modal>
  );
}

function Enquiries() {
  const toast = useToast();
  const r = useAsync(() => api.get('/v1/businesses/enquiries'));
  const [reply, setReply] = useState<Record<string, string>>({});
  if (r.loading) return <Skeleton lines={4} />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const { received, sent } = r.data;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Received">
        {!received.length ? <p className="text-sm text-gray-500">No enquiries received.</p> : (
          <ul className="divide-y">
            {received.map((e: any) => (
              <li key={e.id} className="py-3 text-sm">
                <p className="font-semibold">{e.from_name} <span className="text-xs font-normal text-gray-500">{e.from_district} · {fmtDateTime(e.created_at)}</span></p>
                <p className="mt-1">{e.message}</p>
                {e.commodity && <p className="text-xs text-gray-500">Lot: {e.commodity}, {e.quantity_available} {e.unit}</p>}
                <p className="text-xs text-gray-500">{e.phone ? `Phone shared: ${e.phone}` : 'Phone not shared'}</p>
                {e.reply ? <p className="mt-1 rounded bg-emerald-50 p-2 text-xs">Your reply: {e.reply}</p> : (
                  <form className="mt-2 flex gap-2" onSubmit={async (ev) => { ev.preventDefault(); try { await api.post(`/v1/businesses/enquiries/${e.id}/reply`, { reply: reply[e.id] }); toast('Reply sent'); r.reload(); } catch (err: any) { toast(err.message, 'error'); } }}>
                    <Input aria-label="Reply" value={reply[e.id] ?? ''} onChange={(ev) => setReply({ ...reply, [e.id]: ev.target.value })} placeholder="Reply" />
                    <Button type="submit" size="sm" disabled={!reply[e.id]?.trim()}>Reply</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Sent">
        {!sent.length ? <p className="text-sm text-gray-500">You have not sent any enquiries.</p> : (
          <ul className="divide-y">
            {sent.map((e: any) => (
              <li key={e.id} className="py-3 text-sm">
                <p className="font-semibold">{e.business_name || 'Verified buyer'} <span className="text-xs font-normal text-gray-500">{fmtDateTime(e.created_at)}</span></p>
                <p className="mt-1 text-gray-700">{e.message}</p>
                {e.reply ? <p className="mt-1 rounded bg-emerald-50 p-2 text-xs">Reply: {e.reply}</p> : <p className="text-xs text-gray-500">Waiting for a reply</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// ---------------- Farm inputs ----------------
export function InputsPage() {
  const { user } = useAuth();
  const dealer = user?.role === 'dealer';
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') || (dealer ? 'sales' : 'shop');
  const tabs = dealer ? [{ id: 'sales', label: 'Orders received' }, { id: 'offers', label: 'My stock & prices' }] : [{ id: 'shop', label: 'Shop' }, { id: 'orders', label: 'My orders' }];
  return (
    <div className="space-y-4">
      <PageHeader title={dealer ? 'Sell Farm Inputs' : 'Buy Farm Inputs'} icon={<ShoppingCart />} subtitle="Seeds, fertilisers and crop-protection products from the FARMDirect catalogue, sold by verified dealers near you." />
      <Tabs value={tab} onChange={(v) => setSp({ tab: v })} tabs={tabs} />
      {tab === 'shop' && <Shop />}
      {(tab === 'orders' || tab === 'sales') && <InputOrders dealer={dealer} />}
      {tab === 'offers' && <DealerOffers />}
    </div>
  );
}

function Shop() {
  const { user } = useAuth();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [f, setF] = useState({ q: '', category: '', state: user?.state ?? '' });
  const r = useAsync(() => api.get(`/v1/inputs/offers${qs({ q: f.q || undefined, category: f.category || undefined, state: f.state || undefined })}`), [f.q, f.category, f.state]);
  const [qty, setQty] = useState<Record<string, string>>({});
  const order = async (o: any) => {
    const n = Number(qty[o.id] || 1);
    if (!(n >= 1)) return;
    const fulfilment = o.delivery_available ? 'delivery' : 'pickup';
    if (!(await ask('Place this order?', `${n} × ${o.product_name} (${o.pack_size}) from ${o.dealer_name} for ${inr(o.price_inr * n)}. ${fulfilment === 'pickup' ? 'You will collect it from the dealer.' : 'The dealer offers delivery.'} Payment is arranged after the dealer confirms.`, { label: 'Place order' }))) return;
    try { await api.post('/v1/inputs/orders', { offer_id: o.id, quantity: n, fulfilment, confirm: true }); toast('Order placed. The dealer will confirm it.'); r.reload(); }
    catch (e: any) { toast(e.message, 'error'); }
  };
  if (user?.role !== 'farmer' && user?.role !== 'fpo_manager') return <Notice>Only farmer and FPO accounts can order inputs.</Notice>;
  return (
    <>
      {node}
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Search product or brand" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} aria-label="Search" />
        <Select aria-label="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="All categories" options={['seeds', 'fertilizer', 'crop_protection', 'biological', 'soil_health', 'irrigation', 'machinery', 'other'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />
        <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} placeholder="All states" options={INDIAN_STATES} />
      </div>
      {r.loading ? <Skeleton lines={5} /> : r.error ? <ErrorBox error={r.error} onRetry={r.reload} /> : !r.data.offers.length ? (
        <Empty title="No dealer offers here yet" icon={<ShoppingCart />}>Verified dealers add stock for catalogue products. You can still look up products and verify them in the <Link className="underline" to="/products">product catalogue</Link>.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-600"><tr><th className="p-2">Product</th><th className="p-2">Dealer</th><th className="p-2">Pack</th><th className="p-2 text-right">Price</th><th className="p-2">Stock</th><th className="p-2">Order</th></tr></thead>
            <tbody className="divide-y">
              {r.data.offers.map((o: any) => (
                <tr key={o.id}>
                  <td className="p-2"><Link className="font-semibold underline" to={`/products/${o.product_id}`}>{o.product_name}</Link><p className="text-xs text-gray-500">{o.manufacturer}{o.registration_no ? ` · Reg. ${o.registration_no}` : ''}</p></td>
                  <td className="p-2">{o.dealer_name}<p className="text-xs text-gray-500">{o.district}, {o.state}{o.delivery_available ? ' · delivers' : ' · pickup'}</p></td>
                  <td className="p-2">{o.pack_size}</td>
                  <td className="p-2 text-right">{inr(o.price_inr)}</td>
                  <td className="p-2">{o.stock}</td>
                  <td className="p-2"><div className="flex gap-1"><Input type="number" min="1" max={o.stock} className="w-16" aria-label="Quantity" value={qty[o.id] ?? '1'} onChange={(e) => setQty({ ...qty, [o.id]: e.target.value })} /><Button size="sm" disabled={!o.stock} onClick={() => order(o)}>Order</Button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">{r.data?.note}</p>
    </>
  );
}

function InputOrders({ dealer }: { dealer: boolean }) {
  const toast = useToast();
  const { ask, node } = useConfirm();
  const r = useAsync(() => api.get('/v1/inputs/orders'));
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); r.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  if (r.loading) return <Skeleton lines={4} />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  if (!r.data.orders.length) return <Empty title="No orders yet" />;
  return (
    <ul className="divide-y rounded-2xl border bg-white">
      {node}
      {r.data.orders.map((o: any) => (
        <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
          <div>
            <p className="font-semibold">{o.quantity} × {o.product_name} ({o.pack_size}) · {inr(o.total)}</p>
            <p className="text-xs text-gray-500">{o.ref} · {dealer ? o.farmer_name : o.dealer_name} · {o.fulfilment} · {fmtDateTime(o.created_at)}</p>
            {o.dealer_note && <p className="text-xs">Dealer note: {o.dealer_note}</p>}
            {o.payment_status && <p className="text-xs">Payment: <StatusBadge status={o.payment_status} /> {o.payment_status === 'required' && !dealer && <Link className="underline" to="/trade?tab=payments">Pay</Link>}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={o.status} />
            {dealer && o.status === 'requested' && <>
              <Button size="sm" onClick={() => act(() => api.post(`/v1/inputs/orders/${o.id}/status`, { status: 'confirmed' }), 'Order confirmed')}>Confirm</Button>
              <Button size="sm" variant="outline" onClick={async () => { const note = prompt('Reason for rejecting'); if (note) act(() => api.post(`/v1/inputs/orders/${o.id}/status`, { status: 'rejected', note }), 'Order rejected'); }}>Reject</Button>
            </>}
            {dealer && o.status === 'confirmed' && <Button size="sm" onClick={() => act(() => api.post(`/v1/inputs/orders/${o.id}/status`, { status: 'ready' }), 'Marked ready')}>Mark ready</Button>}
            {dealer && o.status === 'ready' && <Button size="sm" onClick={() => act(() => api.post(`/v1/inputs/orders/${o.id}/status`, { status: 'fulfilled' }), 'Marked handed over')}>Handed over</Button>}
            {!dealer && ['requested', 'confirmed'].includes(o.status) && <Button size="sm" variant="outline" onClick={async () => { if (await ask('Cancel this order?', 'Stock is returned to the dealer. Any confirmed payment becomes a refund to be processed.', { danger: true, label: 'Cancel order' })) act(() => api.post(`/v1/inputs/orders/${o.id}/cancel`), 'Order cancelled'); }}>Cancel</Button>}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DealerOffers() {
  const { user } = useAuth();
  const toast = useToast();
  const mine = useAsync(() => api.get('/v1/inputs/offers/mine'));
  const products = useAsync(() => api.get('/v1/products'));
  const [f, setF] = useState<any>({ product_id: '', pack_size: '', price_inr: '', stock: '', state: user?.state ?? '', district: user?.district ?? '', pickup_address: '', delivery_available: false });
  if (user?.verification_status !== 'verified') return <Notice tone="warn" title="Verification needed">Your dealer account must be verified by FARMDirect before you can sell. <Link className="underline" to="/account/verification">Check verification status</Link>.</Notice>;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Add stock">
        <form className="space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/v1/inputs/offers', { ...f, price_inr: Number(f.price_inr), stock: Number(f.stock), pickup_address: f.pickup_address || null }); toast('Offer added'); mine.reload(); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Field label="Catalogue product" required>{(id) => <Select id={id} value={f.product_id} onChange={(e) => setF({ ...f, product_id: e.target.value })} placeholder="Choose a published product" options={(products.data?.products ?? []).map((p: any) => ({ value: p.id, label: `${p.name} – ${p.manufacturer}` }))} />}</Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Pack size" required>{(id) => <Input id={id} value={f.pack_size} onChange={(e) => setF({ ...f, pack_size: e.target.value })} placeholder="1 kg" />}</Field>
            <Field label="Price (₹)" required>{(id) => <Input id={id} type="number" min="0" value={f.price_inr} onChange={(e) => setF({ ...f, price_inr: e.target.value })} />}</Field>
            <Field label="Stock" required>{(id) => <Input id={id} type="number" min="0" value={f.stock} onChange={(e) => setF({ ...f, stock: e.target.value })} />}</Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="State" required>{(id) => <Select id={id} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={INDIAN_STATES} />}</Field>
            <Field label="District" required>{(id) => <Input id={id} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} />}</Field>
          </div>
          <Field label="Pickup address">{(id) => <Input id={id} value={f.pickup_address} onChange={(e) => setF({ ...f, pickup_address: e.target.value })} />}</Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.delivery_available} onChange={(e) => setF({ ...f, delivery_available: e.target.checked })} />I can deliver</label>
          <Button type="submit" disabled={!f.product_id || !f.pack_size || f.price_inr === '' || f.stock === ''}>Add</Button>
        </form>
      </Section>
      <Section title="My offers">
        {mine.loading ? <Skeleton /> : !mine.data?.offers.length ? <p className="text-sm text-gray-500">No offers yet.</p> : (
          <ul className="divide-y text-sm">
            {mine.data.offers.map((o: any) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                <div><p className="font-semibold">{o.product_name} · {o.pack_size}</p><p className="text-xs text-gray-500">{inr(o.price_inr)} · stock {o.stock} · {o.status}</p></div>
                <Button size="sm" variant="outline" onClick={async () => { try { await api.patch(`/v1/inputs/offers/${o.id}`, { status: o.status === 'active' ? 'paused' : 'active' }); mine.reload(); } catch (e: any) { toast(e.message, 'error'); } }}>{o.status === 'active' ? 'Pause' : 'Resume'}</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

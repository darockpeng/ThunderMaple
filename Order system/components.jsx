// Thunder Maple order system — React components
// Uses global window.TM_MENU, window.TM_INFO from menu_data.js

const { useState, useEffect, useMemo, useRef } = React;

// ============ Tweakable defaults ============
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "paper",
  "itemUI": "stepper",
  "showTax": true,
  "showDelivery": true,
  "enforceMinOrder": "warn",
  "submitTarget": "mailto",
  "webhookUrl": "",
  "formspreeUrl": ""
}/*EDITMODE-END*/;

// ============ Small UI atoms ============
const Tag = ({ children, variant }) => {
  const colors = {
    "Popular":    { bg: "#F4E3D3", fg: "#8A4A1E" },
    "Best Value": { bg: "#E8DCC9", fg: "#5F4A2E" },
    "Premium":    { bg: "#2A2A2A", fg: "#F5EEE3" },
    "New":        { bg: "#DCE6DC", fg: "#2E5C3E" },
    "Vegan":      { bg: "#DCE6DC", fg: "#2E5C3E" },
    "Spicy":      { bg: "#F6D9D1", fg: "#A23E2A" },
    "Save $15":   { bg: "#F4E3D3", fg: "#8A4A1E" },
  };
  const c = colors[children] || { bg: "#EFE8DC", fg: "#5A4A36" };
  return (
    <span className="tm-tag" style={{ background: c.bg, color: c.fg }}>
      {children}
    </span>
  );
};

const MapleLeaf = ({ size = 20, color = "#B83A26" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden>
    <path d="M12 2l1.2 4.8L18 4l-1.5 4.8 5.5.2-4.5 3.3 3.5 3.8-5.3-1 .3 5-4-3.5-4 3.5.3-5-5.3 1 3.5-3.8L2 9l5.5-.2L6 4l4.8 2.8L12 2z"/>
  </svg>
);

const QtyStepper = ({ value, onChange }) => (
  <div className="tm-qty">
    <button
      type="button"
      aria-label="decrease"
      onClick={() => onChange(Math.max(0, value - 1))}
      disabled={value === 0}
    >–</button>
    <span className={value > 0 ? "active" : ""}>{value}</span>
    <button type="button" aria-label="increase" onClick={() => onChange(value + 1)}>+</button>
  </div>
);

// ============ Menu item row ============
const MenuRow = ({ item, qty, onQty, itemUI }) => {
  return (
    <li className="tm-row">
      <div className="tm-row-main">
        <div className="tm-row-head">
          <span className="tm-row-code">{item.code}</span>
          <h3 className="tm-row-name">{item.name}</h3>
          {item.tag && <Tag>{item.tag}</Tag>}
        </div>
        <p className="tm-row-desc">{item.desc}</p>
        <div className="tm-row-meta">
          <span>Serves {item.serves}</span>
          <span className="tm-dot">·</span>
          <span className="tm-price">${item.price.toFixed(2)}</span>
        </div>
      </div>
      <div className="tm-row-action">
        {itemUI === "dropdown" ? (
          <select
            value={qty}
            onChange={(e) => onQty(parseInt(e.target.value, 10))}
            className="tm-select"
            aria-label={`Quantity for ${item.name}`}
          >
            {Array.from({ length: 21 }, (_, i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        ) : (
          <QtyStepper value={qty} onChange={onQty} />
        )}
      </div>
    </li>
  );
};

// ============ Order summary ============
const OrderSummary = ({
  menuFlat, qtys, onQty, customer, setCustomer,
  promo, setPromo, promoState, setPromoState,
  showTax, showDelivery, enforceMinOrder, onSubmit, submitState
}) => {
  const lines = useMemo(
    () => menuFlat.filter(i => (qtys[i.code] || 0) > 0)
      .map(i => ({ ...i, qty: qtys[i.code], lineTotal: i.price * qtys[i.code] })),
    [menuFlat, qtys]
  );
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = promoState.valid ? (promoState.kind === "pct" ? subtotal * promoState.value : promoState.value) : 0;
  const afterDiscount = Math.max(0, subtotal - discount);
  const delivery = showDelivery ? (afterDiscount >= 80 || afterDiscount === 0 ? 0 : 10) : 0;
  const tax = showTax ? afterDiscount * 0.13 : 0;
  const total = afterDiscount + delivery + tax;

  // Min order check: 1 platter (SP*) OR 5 individual sets (IS*)
  const platterCount = lines.filter(l => l.code.startsWith("SP")).reduce((s, l) => s + l.qty, 0);
  const individualCount = lines.filter(l => l.code.startsWith("IS")).reduce((s, l) => s + l.qty, 0);
  const hasAnyItems = lines.length > 0;
  const meetsMin = platterCount >= 1 || individualCount >= 5 || lines.some(l => l.code.startsWith("TC") || l.code.startsWith("TP"));
  const minWarn = hasAnyItems && !meetsMin;

  // Today + 2 days for min date
  const minDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }, []);

  const applyPromo = () => {
    const code = promo.trim().toUpperCase();
    const codes = {
      "MAPLE10":   { valid: true, kind: "pct", value: 0.10, label: "10% off" },
      "WELCOME5":  { valid: true, kind: "flat", value: 5,   label: "$5 off" },
      "OFFICE15":  { valid: true, kind: "flat", value: 15,  label: "$15 off (office orders)" },
    };
    if (!code) { setPromoState({ valid: false, msg: "" }); return; }
    if (codes[code]) { setPromoState({ ...codes[code], code, msg: `Applied: ${codes[code].label}` }); }
    else { setPromoState({ valid: false, msg: "Code not recognized" }); }
  };

  const canSubmit = hasAnyItems
    && customer.name && customer.phone && customer.email && customer.address && customer.deliveryDate
    && (enforceMinOrder !== "hard" || meetsMin);

  return (
    <aside className="tm-summary">
      <div className="tm-summary-inner">
        <header className="tm-summary-head">
          <h2>Your Order</h2>
          <span className="tm-summary-count">{lines.reduce((s, l) => s + l.qty, 0)} items</span>
        </header>

        {!hasAnyItems && (
          <div className="tm-empty">
            <div className="tm-empty-icon"><MapleLeaf size={28} color="#D9C9B0" /></div>
            <p>No items yet. Pick something you'd like from the menu.</p>
          </div>
        )}

        {hasAnyItems && (
          <ul className="tm-lines">
            {lines.map(l => (
              <li key={l.code} className="tm-line">
                <div className="tm-line-main">
                  <div className="tm-line-name">{l.name}</div>
                  <div className="tm-line-sub">
                    <button type="button" className="tm-line-btn" onClick={() => onQty(l.code, Math.max(0, l.qty - 1))}>–</button>
                    <span>{l.qty}</span>
                    <button type="button" className="tm-line-btn" onClick={() => onQty(l.code, l.qty + 1)}>+</button>
                    <span className="tm-line-unit">× ${l.price.toFixed(2)}</span>
                  </div>
                </div>
                <div className="tm-line-total">${l.lineTotal.toFixed(2)}</div>
              </li>
            ))}
          </ul>
        )}

        {minWarn && (
          <div className={`tm-warn ${enforceMinOrder === "hard" ? "hard" : ""}`}>
            Minimum order: 1 platter, or 5 individual sets, or any team combo.
          </div>
        )}

        {hasAnyItems && (
          <div className="tm-totals">
            <div className="tm-promo">
              <input
                type="text"
                placeholder="Promo code"
                value={promo}
                onChange={(e) => setPromo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), applyPromo())}
              />
              <button type="button" onClick={applyPromo}>Apply</button>
            </div>
            {promoState.msg && (
              <div className={`tm-promo-msg ${promoState.valid ? "ok" : "bad"}`}>{promoState.msg}</div>
            )}

            <div className="tm-tot-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
            {discount > 0 && <div className="tm-tot-row discount"><span>Discount</span><span>–${discount.toFixed(2)}</span></div>}
            {showDelivery && <div className="tm-tot-row"><span>Delivery {afterDiscount >= 80 ? "(free)" : ""}</span><span>${delivery.toFixed(2)}</span></div>}
            {showTax && <div className="tm-tot-row"><span>HST (13%)</span><span>${tax.toFixed(2)}</span></div>}
            <div className="tm-tot-row total"><span>Total</span><span>${total.toFixed(2)}</span></div>
          </div>
        )}

        <div className="tm-form">
          <h3>Delivery details</h3>
          <div className="tm-field">
            <label>Name</label>
            <input type="text" value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Jane Smith" />
          </div>
          <div className="tm-field-row">
            <div className="tm-field">
              <label>Phone</label>
              <input type="tel" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="(807) 555-0123" />
            </div>
            <div className="tm-field">
              <label>Email</label>
              <input type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} placeholder="jane@company.com" />
            </div>
          </div>
          <div className="tm-field">
            <label>Company / Team <span className="optional">(optional)</span></label>
            <input type="text" value={customer.company} onChange={(e) => setCustomer({ ...customer, company: e.target.value })} placeholder="Acme Corp" />
          </div>
          <div className="tm-field">
            <label>Delivery address</label>
            <input type="text" value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} placeholder="Street, city, postal code" />
          </div>
          <div className="tm-field-row">
            <div className="tm-field">
              <label>Delivery date</label>
              <input type="date" min={minDate} value={customer.deliveryDate} onChange={(e) => setCustomer({ ...customer, deliveryDate: e.target.value })} />
              <div className="tm-field-hint">48 hrs advance notice required</div>
            </div>
            <div className="tm-field">
              <label>Time</label>
              <input type="time" value={customer.deliveryTime} onChange={(e) => setCustomer({ ...customer, deliveryTime: e.target.value })} />
            </div>
          </div>
          <div className="tm-field">
            <label>Dietary restrictions / allergies <span className="optional">(optional)</span></label>
            <textarea rows="2" value={customer.dietary} onChange={(e) => setCustomer({ ...customer, dietary: e.target.value })} placeholder="e.g. one guest is gluten-free; no shellfish" />
          </div>
        </div>

        <button
          type="button"
          className="tm-submit"
          disabled={!canSubmit}
          onClick={onSubmit}
        >
          {submitState === "sending" ? "Sending…" : "Place Order"}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 8h12M10 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button type="button" className="tm-print" onClick={() => window.print()}>
          Print / Save as PDF
        </button>

        <div className="tm-notes">
          <div>Free delivery on orders $80+ · $10 under $80</div>
          <div>Min order: 1 platter, 5 individual sets, or any team combo</div>
        </div>
      </div>
    </aside>
  );
};

// ============ Category nav ============
const CategoryNav = ({ categories, active, onPick }) => (
  <nav className="tm-nav">
    {categories.map(c => (
      <button
        key={c}
        type="button"
        className={active === c ? "active" : ""}
        onClick={() => onPick(c)}
      >{c}</button>
    ))}
  </nav>
);

// ============ Confirmation modal ============
const Confirmation = ({ order, onClose }) => {
  if (!order) return null;
  return (
    <div className="tm-modal-bg" onClick={onClose}>
      <div className="tm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tm-modal-head">
          <MapleLeaf size={36} />
          <h2>Order received</h2>
          <p>Order ID <strong>{order.id}</strong></p>
        </div>
        <div className="tm-modal-body">
          <p>Thank you, {order.customer.name}. Your order has been queued.</p>
          <p>We'll confirm by phone or email within 24 hours. Delivery: {order.customer.deliveryDate} at {order.customer.deliveryTime || "—"}.</p>
          <div className="tm-modal-total">
            <span>Total</span>
            <strong>${order.total.toFixed(2)}</strong>
          </div>
        </div>
        <div className="tm-modal-actions">
          <button type="button" onClick={() => window.print()}>Print receipt</button>
          <button type="button" className="primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

// ============ Tweaks panel ============
const TweaksPanel = ({ visible, settings, setSettings }) => {
  if (!visible) return null;
  const upd = (k, v) => {
    const next = { ...settings, [k]: v };
    setSettings(next);
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
  };
  return (
    <div className="tm-tweaks">
      <h4>Tweaks</h4>
      <label><span>Theme</span>
        <select value={settings.theme} onChange={(e) => upd("theme", e.target.value)}>
          <option value="paper">Paper (warm)</option>
          <option value="ink">Ink (dark)</option>
          <option value="maple">Maple (red accent strong)</option>
        </select>
      </label>
      <label><span>Item UI</span>
        <select value={settings.itemUI} onChange={(e) => upd("itemUI", e.target.value)}>
          <option value="stepper">+/– stepper</option>
          <option value="dropdown">Dropdown (0–20)</option>
        </select>
      </label>
      <label className="row"><input type="checkbox" checked={settings.showTax} onChange={(e) => upd("showTax", e.target.checked)} /><span>Show HST 13%</span></label>
      <label className="row"><input type="checkbox" checked={settings.showDelivery} onChange={(e) => upd("showDelivery", e.target.checked)} /><span>Show delivery fee</span></label>
      <label><span>Min order enforcement</span>
        <select value={settings.enforceMinOrder} onChange={(e) => upd("enforceMinOrder", e.target.value)}>
          <option value="hard">Block submit</option>
          <option value="warn">Warn only</option>
          <option value="off">Off</option>
        </select>
      </label>
      <label><span>Submit to</span>
        <select value={settings.submitTarget} onChange={(e) => upd("submitTarget", e.target.value)}>
          <option value="mailto">Email (mailto)</option>
          <option value="formspree">Formspree</option>
          <option value="webhook">Webhook (JSON POST)</option>
          <option value="local">Local only</option>
        </select>
      </label>
      {settings.submitTarget === "formspree" && (
        <label><span>Formspree URL</span>
          <input type="url" placeholder="https://formspree.io/f/..." value={settings.formspreeUrl} onChange={(e) => upd("formspreeUrl", e.target.value)} />
        </label>
      )}
      {settings.submitTarget === "webhook" && (
        <label><span>Webhook URL</span>
          <input type="url" placeholder="https://your-server/order" value={settings.webhookUrl} onChange={(e) => upd("webhookUrl", e.target.value)} />
        </label>
      )}
    </div>
  );
};

// Exports
Object.assign(window, {
  MenuRow, OrderSummary, CategoryNav, Confirmation, TweaksPanel, MapleLeaf, Tag
});

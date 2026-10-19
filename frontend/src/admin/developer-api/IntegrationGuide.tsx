import React, { useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, Copy } from "lucide-react";
import api from "../../lib/api";

const apiRoot = () => {
  const base = String(api.defaults.baseURL || "/api");
  return (/^https?:/i.test(base) ? base : `${window.location.origin}${base}`).replace(/\/$/, "");
};

const ENDPOINTS: { method: string; path: string; permission: string; note: string }[] = [
  { method: "GET", path: "/v1/bookings", permission: "bookings.read", note: "List bookings (filters: ashramId, status, startDate, endDate, page, limit)" },
  { method: "GET", path: "/v1/bookings/{id}", permission: "bookings.read", note: "One booking by id or booking reference (TRV-…)" },
  { method: "GET", path: "/v1/inventory/availability", permission: "inventory.read", note: "Room availability & price per day (ashramId, startDate, endDate, roomId?)" },
  { method: "GET", path: "/v1/payments/{id}/status", permission: "payments.read", note: "Payment status by payment id, booking reference or transaction id" },
];

const SAMPLE_EVENT = `{
  "id": "5b0c7c0e-9f0a-4c35-9a52-1f3a1d5f7e21",
  "type": "booking.created",
  "apiVersion": "v1",
  "createdAt": "2026-10-19T12:30:00.000Z",
  "data": {
    "bookingId": "TRV-MV6G8AGP-26281",
    "ashramId": "6acf4e382c6782d733f7ff59",
    "status": "pending",
    "checkInDate": "2026-11-01T00:00:00.000Z",
    "checkOutDate": "2026-11-03T00:00:00.000Z",
    "totalAmount": 3200
  }
}`;

const VERIFY_SNIPPET = `// Node.js (Express) — verify before trusting the event
import crypto from "node:crypto";

app.post("/webhooks/tirvona", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("X-Tirvona-Signature");          // "t=1760875800,v1=ab12…"
  const [t, v1] = header.split(",").map((p) => p.split("=")[1]);
  const expected = crypto
    .createHmac("sha256", process.env.TIRVONA_WEBHOOK_SECRET)   // whsec_…
    .update(\`t=\${t}.\${req.body.toString("utf8")}\`)           // raw body, not re-serialised JSON
    .digest("hex");

  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300;   // reject replays older than 5 min
  const ok = crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  if (!ok || !fresh) return res.sendStatus(400);

  const event = JSON.parse(req.body);                            // { id, type, data, … }
  // de-duplicate on event.id — Tirvona retries failed deliveries with the same id
  res.sendStatus(200);                                           // any 2xx = delivered
});`;

const Code: React.FC<{ id: string; text: string }> = ({ id, text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl border border-gray-100 bg-gray-50 p-3 pr-10 text-[11px] leading-relaxed text-[#0B192C] dark:border-slate-800 dark:bg-slate-900 dark:text-gray-200">
        <code id={id}>{text}</code>
      </pre>
      <button
        type="button"
        title="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        }}
        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
      >
        {copied ? <CheckCircle2 size={15} className="text-emerald-500" /> : <Copy size={15} />}
      </button>
    </div>
  );
};

/** Quick-start for partner developers: auth, endpoints, webhook payload and signature check. */
export const IntegrationGuide: React.FC = () => {
  const [open, setOpen] = useState(false);
  const root = apiRoot();

  return (
    <div className="rounded-[22px] border border-gray-100 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#0B192C]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/15 bg-emerald-500/10 text-emerald-600">
            <BookOpen size={17} />
          </span>
          <span>
            <span className="block text-sm font-black text-[#0B192C] dark:text-white">Integration Guide</span>
            <span className="block text-[11px] font-semibold text-gray-400">
              How a partner calls the API and verifies webhooks
            </span>
          </span>
        </span>
        <ChevronDown size={18} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="mt-5 space-y-6 text-xs text-gray-600 dark:text-gray-300">
          <section className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400">1 · Authenticate</h4>
            <p>
              Send the key in the <code className="font-mono">X-API-Key</code> header (or as a Bearer token). Keys start with{" "}
              <code className="font-mono">tv_test_</code> (sandbox) or <code className="font-mono">tv_live_</code> (production).
              The secret is shown once, when the key is generated.
            </p>
            <Code
              id="guide-curl"
              text={`curl "${root}/v1/bookings?limit=5" \\\n  -H "X-API-Key: tv_live_xxxxxxxxxxxxxxxxxxxxxxxx"`}
            />
          </section>

          <section className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400">2 · Endpoints</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-gray-50 dark:divide-slate-800/60">
                  {ENDPOINTS.map((e) => (
                    <tr key={e.path}>
                      <td className="py-2 pr-3 font-mono font-bold text-emerald-600">{e.method}</td>
                      <td className="py-2 pr-3 font-mono font-bold text-[#0B192C] dark:text-white">{e.path}</td>
                      <td className="py-2 pr-3 font-mono text-purple-600">{e.permission}</td>
                      <td className="py-2">{e.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Responses are <code className="font-mono">{`{ "success": true, "data": … }`}</code>. A partner scoped to specific
              properties only sees those properties. Interactive docs:{" "}
              <a className="font-bold text-[#F28C28] underline" href={`${root}/docs`} target="_blank" rel="noreferrer">
                {root}/docs
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400">3 · Receive webhooks</h4>
            <p>
              Register an HTTPS URL, pick events, then use <strong>Send test</strong> on the webhook to check your receiver. Every
              delivery is a <code className="font-mono">POST</code> with these headers:{" "}
              <code className="font-mono">X-Tirvona-Event</code>, <code className="font-mono">X-Tirvona-Delivery-Id</code> and{" "}
              <code className="font-mono">X-Tirvona-Signature: t=&lt;unix&gt;,v1=&lt;hmac&gt;</code>. Failed deliveries (non-2xx
              or no answer within 10 s) retry with backoff: 15 s, 30 s, 1 m, 2 m, 4 m.
            </p>
            <Code id="guide-event" text={SAMPLE_EVENT} />
          </section>

          <section className="space-y-2">
            <h4 className="text-[11px] font-black uppercase tracking-wider text-gray-400">4 · Verify the signature</h4>
            <p>
              The signature is an HMAC-SHA256 (hex) of <code className="font-mono">t=&lt;timestamp&gt;.&lt;raw request body&gt;</code>{" "}
              keyed with the webhook's signing secret (<code className="font-mono">whsec_…</code>).
            </p>
            <Code id="guide-verify" text={VERIFY_SNIPPET} />
          </section>
        </div>
      )}
    </div>
  );
};

export default IntegrationGuide;

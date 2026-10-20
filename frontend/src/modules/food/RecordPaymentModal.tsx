/**
 * Super Admin / Finance: record money Tirvona paid a kitchen. Customers pay Tirvona, so the kitchen is
 * paid by hand (bank transfer, UPI or cash) and each payment is entered here with its receipt image.
 * Cash is the only method without a receipt.
 */
import React, { useEffect, useRef, useState } from "react";
import { Banknote, ImagePlus, Landmark, Loader2, Smartphone, X } from "lucide-react";
import { getErrorMessage } from "../../lib/api";
import { toast } from "../../lib/toast";
import { uploadService } from "../../services";
import { foodWalletService } from "../../services/foodWallet.service";
import type { FoodPaymentMethod, FoodWallet } from "../../services/foodWallet.service";
import { Button, Field, Modal, Notice, cx, formatMinor, inputClass } from "../pandit/ui";

const inr = (minor?: number | null) => formatMinor(minor ?? 0) ?? "₹0";

const METHODS: Array<{ key: FoodPaymentMethod; label: string; icon: React.ReactNode }> = [
  { key: "bank_transfer", label: "Bank transfer", icon: <Landmark size={16} /> },
  { key: "upi", label: "UPI", icon: <Smartphone size={16} /> },
  { key: "cash", label: "Cash", icon: <Banknote size={16} /> },
];

const MAX_PAISE = 100_000_000; // the server's limit per entry: ₹10,00,000

/** What a person would type: "2495.40" for paise, "2500" for whole rupees. */
const rupeesText = (paise: number) => (paise % 100 ? (paise / 100).toFixed(2) : String(paise / 100));

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** One per opened form: a double click or a retry then records a single payment. */
const newRequestId = () =>
  globalThis.crypto?.randomUUID?.() ?? `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const RecordPaymentModal: React.FC<{
  open: boolean;
  vendor: { id: string; name: string };
  /** What Tirvona owes the kitchen right now (negative when it paid ahead). */
  remainingPaise: number;
  onClose: () => void;
  onRecorded: (wallet: FoodWallet) => void;
}> = ({ open, vendor, remainingPaise, onClose, onRecorded }) => {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<FoodPaymentMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [date, setDate] = useState(localDate());
  const [note, setNote] = useState("");
  const [requestId, setRequestId] = useState(newRequestId());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAmount(remainingPaise > 0 ? rupeesText(remainingPaise) : "");
    setMethod("bank_transfer");
    setReference("");
    setReceiptUrl("");
    setDate(localDate());
    setNote("");
    setRequestId(newRequestId());
    setErrors({});
    // Only when the dialog opens: the balance behind it may change while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const amountPaise = Math.round(Number(amount) * 100);
  const aheadPaise = Number.isFinite(amountPaise) && remainingPaise > 0 ? amountPaise - remainingPaise : amountPaise;
  const overpaying = Number.isFinite(amountPaise) && amountPaise > 0 && aheadPaise > 0;

  const chooseReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("The receipt must be an image (a photo or screenshot).");
      return;
    }
    setUploading(true);
    try {
      setReceiptUrl(await uploadService.file(file, "food-receipts"));
      setErrors((prev) => ({ ...prev, receipt: "" }));
    } catch (err) {
      toast.error(getErrorMessage(err, "The receipt could not be uploaded."));
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!amount || !Number.isFinite(amountPaise) || amountPaise <= 0) next.amount = "Enter the amount Tirvona paid.";
    else if (amountPaise < 100) next.amount = "The smallest payment is ₹1.";
    else if (amountPaise > MAX_PAISE) next.amount = "The most you can record in one entry is ₹10,00,000. Record it as several payments.";
    if (method !== "cash" && !receiptUrl) next.receipt = "Upload the payment receipt, or choose Cash if there is none.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setSaving(true);
    try {
      const wallet = await foodWalletService.recordPayment(vendor.id, {
        amountPaise,
        method,
        reference: reference.trim() || undefined,
        receiptUrl: method === "cash" ? undefined : receiptUrl,
        // Today means "now"; an earlier day is noon of that day, so it never lands on the wrong date.
        paidAt: date && date !== localDate() ? new Date(`${date}T12:00:00`).toISOString() : undefined,
        note: note.trim() || undefined,
        idempotencyKey: requestId,
      });
      toast.success(`${inr(amountPaise)} recorded as paid to ${vendor.name}.`);
      onRecorded(wallet);
    } catch {
      // The API layer already showed why it failed.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={saving ? () => undefined : onClose}
      closeOnBackdrop={!saving}
      title="Record a payment"
      description={`Money Tirvona paid to ${vendor.name}. It reduces what Tirvona owes the kitchen.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={uploading}>
            Record payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {remainingPaise > 0 ? (
            <>
              Tirvona currently owes this kitchen <strong className="text-[#0B192C] dark:text-white">{inr(remainingPaise)}</strong>.
            </>
          ) : remainingPaise < 0 ? (
            <>
              Tirvona has already paid this kitchen <strong className="text-[#0B192C] dark:text-white">{inr(-remainingPaise)}</strong> ahead of its orders.
            </>
          ) : (
            <>Nothing is owed to this kitchen right now.</>
          )}
        </p>

        <Field label="Amount paid (₹)" required error={errors.amount}>
          <input
            className={inputClass}
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, "").replace(/^(\d*\.\d{0,2}).*$/, "$1"))}
            inputMode="decimal"
            autoComplete="off"
            data-autofocus
          />
        </Field>
        {remainingPaise > 0 && Math.round(Number(amount) * 100) !== remainingPaise && (
          <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setAmount(rupeesText(remainingPaise))}>
            Pay the full {inr(remainingPaise)}
          </Button>
        )}
        {overpaying && (
          <Notice tone="warning">
            This is {inr(aheadPaise)} more than Tirvona currently owes this kitchen. It is still recorded, and shows as an advance that later orders use up.
          </Notice>
        )}

        <div>
          <p className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">How was it paid?</p>
          <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
            {METHODS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={method === m.key}
                onClick={() => {
                  setMethod(m.key);
                  setErrors((prev) => ({ ...prev, receipt: "" }));
                }}
                className={cx(
                  "flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] sm:flex-row sm:gap-2 sm:text-sm",
                  method === m.key
                    ? "border-[#F28C28] bg-[#FFF4E5] text-[#0B192C] dark:bg-[#F28C28]/15 dark:text-white"
                    : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800",
                )}
              >
                {m.icon}
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {method === "cash" ? (
          <p className="rounded-xl bg-gray-50 px-4 py-3 text-xs text-gray-600 dark:bg-slate-900 dark:text-gray-300">
            Cash has no receipt, so there is nothing to upload. Use the note below to say who handed it over.
          </p>
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-gray-800 dark:text-gray-200">
                Payment receipt (image)
                <span className="ml-0.5 text-rose-600" aria-hidden="true">
                  *
                </span>
              </p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={chooseReceipt} />
              {receiptUrl ? (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 p-2.5 dark:border-slate-700">
                  <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" aria-label="Open the receipt in a new tab">
                    <img src={receiptUrl} alt="Payment receipt" className="h-20 w-20 rounded-lg border border-gray-200 object-cover dark:border-slate-700" />
                  </a>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <Button variant="outline" className="!min-h-[36px] !px-3" onClick={() => fileRef.current?.click()} disabled={uploading}>
                      Replace
                    </Button>
                    <Button variant="ghost" className="!min-h-[36px] !px-3" onClick={() => setReceiptUrl("")} disabled={uploading}>
                      <X size={14} aria-hidden="true" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="flex w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#F28C28]/40 bg-[#F28C28]/5 py-5 text-[#F28C28] transition-colors hover:bg-[#F28C28]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <Loader2 size={20} className="animate-spin" aria-hidden="true" /> : <ImagePlus size={20} aria-hidden="true" />}
                  <span className="text-sm font-extrabold">{uploading ? "Uploading receipt…" : "Upload receipt image"}</span>
                  <span className="text-[11px] font-semibold text-gray-400">A screenshot of the bank / UPI payment, or a photo of the slip</span>
                </button>
              )}
              {errors.receipt && (
                <p role="alert" className="mt-1 text-xs font-semibold text-rose-700 dark:text-rose-300">
                  {errors.receipt}
                </p>
              )}
            </div>
            <Field label="Bank UTR / UPI transaction id" hint="Optional, but it makes the payment easy to find later.">
              <input className={inputClass} value={reference} maxLength={80} onChange={(e) => setReference(e.target.value)} autoComplete="off" />
            </Field>
          </>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Date paid" hint="Leave as today unless it was paid earlier.">
            <input type="date" className={inputClass} value={date} max={localDate()} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Note (optional)">
            <input className={inputClass} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder={method === "cash" ? "e.g. handed to the owner at the shop" : "e.g. payment for 1–7 Oct"} />
          </Field>
        </div>
      </div>
    </Modal>
  );
};

export default RecordPaymentModal;

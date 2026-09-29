import React, { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { EnterprisePageHeader } from "../../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../shared/components/EnterpriseButton";
import { marketplaceAdminApi } from "../../../services/marketplace.service";
import { Field, Panel, PanelState, inputClass, useAction, useRemote } from "../../../modules/marketplace/ui";
import { useMarketplaceRoles } from "./MarketplaceVendorsPage";

const FIELDS: Array<{ key: string; label: string; hint: string; step?: string }> = [
  { key: "defaultCommissionPercent", label: "Default commission %", hint: "Used when neither the vendor nor its category has an override.", step: "0.1" },
  { key: "settlementHoldDays", label: "Settlement hold (days)", hint: "Days after delivery before earnings become available. Keep ≥ return window." },
  { key: "returnWindowDays", label: "Return window (days)", hint: "0 turns customer returns off." },
  { key: "defaultGstPercent", label: "Default GST % (0/5/12/18/28)", hint: "For products without their own GST rate." },
  { key: "shippingFee", label: "Shipping fee per store (₹)", hint: "Charged per vendor order." },
  { key: "freeShippingAbove", label: "Free shipping above (₹)", hint: "Per vendor order subtotal." },
  { key: "reservationMinutes", label: "Stock hold for unpaid orders (min)", hint: "5–60 minutes." },
  { key: "minimumPayoutAmount", label: "Minimum payout (₹)", hint: "Smallest payout a vendor can request." },
];

export const MarketplaceSettingsAdminPage: React.FC = () => {
  const { data, state, error, reload } = useRemote<Record<string, number>>(() => marketplaceAdminApi.settings(), []);
  const [form, setForm] = useState<Record<string, string>>({});
  const { busy, run } = useAction();
  const { isSuper } = useMarketplaceRoles();

  useEffect(() => {
    if (data) setForm(Object.fromEntries(FIELDS.map((f) => [f.key, String(data[f.key] ?? "")])));
  }, [data]);

  const save = () =>
    run("save", () => marketplaceAdminApi.updateSettings(Object.fromEntries(FIELDS.map((f) => [f.key, Number(form[f.key])]))), reload, "Settings saved");

  return (
    <div className="space-y-5">
      <EnterprisePageHeader title="Marketplace settings" subtitle="Commission, settlement, shipping and payout rules." icon={<Settings size={20} />} />
      <Panel title="Rules">
        {state !== "ready" ? (
          <PanelState state={state} error={error} onRetry={reload} />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELDS.map((f) => (
                <Field key={f.key} label={f.label} hint={f.hint}>
                  <input
                    className={inputClass}
                    type="number"
                    min={0}
                    step={f.step ?? "1"}
                    value={form[f.key] ?? ""}
                    disabled={!isSuper}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
            {isSuper ? (
              <div className="flex justify-end pt-4">
                <EnterpriseButton loading={busy === "save"} onClick={save}>
                  Save settings
                </EnterpriseButton>
              </div>
            ) : (
              <p className="text-xs text-gray-500 pt-3">Only a Super Admin can change these settings.</p>
            )}
          </>
        )}
      </Panel>

    </div>
  );
};

export default MarketplaceSettingsAdminPage;

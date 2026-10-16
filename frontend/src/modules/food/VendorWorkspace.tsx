import React, { useState } from "react";
import { Pencil, Plus, Power } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { toast } from "../../lib/toast";
import { Empty, Panel, Pill } from "../marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type {
  FoodOutletInput,
  FoodPartnerProfile,
  FoodScope,
} from "../../services/foodPartner.service";
import { OutletForm, VendorDetailsForm, rupees } from "./foodUi";

/** Business details and kitchens of one restaurant. Owner and Super Admin use the same screen. */
export const VendorWorkspace: React.FC<{
  scope: FoodScope;
  profile: FoodPartnerProfile;
  onChanged: () => void | Promise<unknown>;
}> = ({ scope, profile, onChanged }) => {
  const { vendor, outlets } = profile;
  const [busy, setBusy] = useState("");
  const [editingOutlet, setEditingOutlet] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const run = async (key: string, action: () => Promise<unknown>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(success);
      await onChanged();
      return true;
    } catch {
      return false; // the API layer already showed the error
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-5">
      <Panel title="Business, contact & payout details">
        <VendorDetailsForm
          vendor={vendor}
          busy={busy === "vendor"}
          onSubmit={(value) =>
            run(
              "vendor",
              () =>
                scope === "admin"
                  ? foodPartnerService.updateVendor(vendor._id, value)
                  : foodPartnerService.updateMyVendor(value),
              "Details saved",
            )
          }
        />
      </Panel>

      <Panel
        title={`Kitchens / outlets (${outlets.length})`}
        actions={
          !adding && (
            <EnterpriseButton size="sm" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
              Add kitchen
            </EnterpriseButton>
          )
        }
      >
        {adding && (
          <div className="mb-5 p-4 rounded-2xl border border-dashed border-[#F28C28]/50 bg-orange-50/30 dark:bg-slate-900/40">
            <p className="text-xs font-black mb-3 text-[#0B192C] dark:text-white">New kitchen</p>
            <OutletForm
              submitLabel="Add kitchen"
              busy={busy === "add"}
              onCancel={() => setAdding(false)}
              onSubmit={async (value: FoodOutletInput) => {
                const ok = await run("add", () => foodPartnerService.addOutlet(scope, vendor._id, value), "Kitchen added. It starts closed: open it when your menu is ready.");
                if (ok) setAdding(false);
              }}
            />
          </div>
        )}

        {outlets.length === 0 && !adding ? (
          <Empty
            title="No kitchen added yet"
            text="Add the kitchen customers will order from. Without one, nothing can be listed."
          />
        ) : (
          <div className="space-y-4">
            {outlets.map((o) => (
              <div key={o._id} className="rounded-2xl border border-gray-100 dark:border-slate-800 p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#0B192C] dark:text-white">{o.brandName}</p>
                    <p className="text-[11px] text-gray-500">{o.address}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {o.openTime}–{o.closeTime} · Min order {rupees(o.minOrderPaise)} · {o.serviceZoneCodes?.join(", ") || "No zones"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Pill label={o.isPaused ? "Kitchen closed" : "Kitchen open"} tone={o.isPaused ? "gray" : "green"} />
                    <EnterpriseButton
                      variant="outline"
                      size="sm"
                      icon={<Power size={12} />}
                      loading={busy === `pause-${o._id}`}
                      disabled={Boolean(busy)}
                      onClick={() =>
                        run(`pause-${o._id}`, () => foodPartnerService.setOutletPaused(scope, o._id, !o.isPaused), o.isPaused ? "Kitchen opened" : "Kitchen closed")
                      }
                    >
                      {o.isPaused ? "Open kitchen" : "Close kitchen"}
                    </EnterpriseButton>
                    <EnterpriseButton variant="outline" size="sm" icon={<Pencil size={12} />} onClick={() => setEditingOutlet(editingOutlet === o._id ? null : o._id)}>
                      Edit
                    </EnterpriseButton>
                  </div>
                </div>
                {editingOutlet === o._id && (
                  <div className="pt-3 border-t border-gray-100 dark:border-slate-800">
                    <OutletForm
                      initial={o}
                      submitLabel="Save kitchen"
                      busy={busy === `edit-${o._id}`}
                      onCancel={() => setEditingOutlet(null)}
                      onSubmit={async (value) => {
                        const ok = await run(`edit-${o._id}`, () => foodPartnerService.updateOutlet(scope, o._id, value), "Kitchen saved");
                        if (ok) setEditingOutlet(null);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};

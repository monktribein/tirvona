import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Store } from "lucide-react";
import { EnterpriseButton } from "../../admin/shared/components/EnterpriseButton";
import { useAuth } from "../../contexts/AuthContext";
import { toast } from "../../lib/toast";
import { Field, Panel, PanelState, inputClass } from "../marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type { FoodOutletInput } from "../../services/foodPartner.service";
import { FoodMenuManager } from "./FoodMenuManager";
import { OutletForm, VendorStatusBanner } from "./foodUi";
import { useMyRestaurant } from "./useMyRestaurant";
import { VendorWorkspace } from "./VendorWorkspace";

const PageHead: React.FC<{ title: string; text: string; right?: React.ReactNode }> = ({ title, text, right }) => (
  <div className="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h1 className="text-xl font-black text-[#0B192C] dark:text-white">{title}</h1>
      <p className="text-xs text-gray-500 mt-0.5">{text}</p>
    </div>
    <div className="flex items-center gap-2">
      {right}
      <Link
        to="/food"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold text-gray-700 dark:text-gray-200 hover:border-[#F28C28] hover:text-[#F28C28] transition-colors"
      >
        View public Food page <ExternalLink size={12} />
      </Link>
    </div>
  </div>
);

/** First-time setup: restaurant details plus the first kitchen. */
const RegisterRestaurant: React.FC<{ onDone: () => void | Promise<unknown> }> = ({ onDone }) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState(user?.name ?? "");
  const [contactPhone, setContactPhone] = useState(user?.phone ?? "");
  const [busy, setBusy] = useState(false);

  const create = async (outlet: FoodOutletInput) => {
    setBusy(true);
    try {
      await foodPartnerService.register({
        businessName: name.trim(),
        ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
        ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
        outlet,
      });
      toast.success("Restaurant submitted. Tirvona will review and approve it.");
      await onDone();
    } catch {
      /* shown by the API layer */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <PageHead title="Set up your restaurant" text="Tell us about your restaurant and first kitchen. You can add more later." />
      <Panel title="Restaurant">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Restaurant / business name" required className="sm:col-span-2">
            <input className={inputClass} required minLength={2} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brijwasi Heritage Foods" />
          </Field>
          <Field label="Contact person">
            <input className={inputClass} maxLength={120} value={contactName} onChange={(e) => setContactName(e.target.value)} />
          </Field>
          <Field label="Contact phone">
            <input className={inputClass} inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value.replace(/[^\d+\s-]/g, ""))} />
          </Field>
        </div>
      </Panel>
      <Panel title="First kitchen">
        {name.trim().length < 2 && <p className="text-[11px] text-amber-600 mb-3">Enter the restaurant name above to continue.</p>}
        <OutletForm submitLabel="Submit for approval" busy={busy} onSubmit={name.trim().length >= 2 ? create : () => { toast.warning("Enter the restaurant name first"); }} />
      </Panel>
    </div>
  );
};

/** Restaurant Profile: sign-up when there is none, otherwise details and kitchens. */
export const RestaurantProfilePage: React.FC = () => {
  const { profile, state, reload } = useMyRestaurant();

  if (state !== "ready") return <PanelState state={state} onRetry={reload} />;
  if (!profile) return <RegisterRestaurant onDone={reload} />;

  return (
    <div className="space-y-5">
      <PageHead title={profile.vendor.businessName} text="Restaurant profile, kitchens and payout details" />
      <VendorStatusBanner status={profile.vendor.status} />
      <VendorWorkspace scope="owner" profile={profile} onChanged={reload} />
    </div>
  );
};

/** Menu & Inventory. */
export const RestaurantMenuPage: React.FC = () => {
  const { profile, state, reload } = useMyRestaurant();

  if (state !== "ready") return <PanelState state={state} onRetry={reload} />;
  if (!profile)
    return (
      <Panel>
        <div className="py-10 text-center space-y-3">
          <Store className="mx-auto text-gray-300" size={30} />
          <p className="text-sm font-black text-[#0B192C] dark:text-white">Register your restaurant first</p>
          <Link to="/restaurant/profile">
            <EnterpriseButton size="sm">Set up restaurant</EnterpriseButton>
          </Link>
        </div>
      </Panel>
    );

  return (
    <div className="space-y-5">
      <PageHead title="Menu & Inventory" text="Add dishes, set prices and daily stock, and mark items sold out" />
      <VendorStatusBanner status={profile.vendor.status} />
      <FoodMenuManager scope="owner" outlets={profile.outlets} />
    </div>
  );
};

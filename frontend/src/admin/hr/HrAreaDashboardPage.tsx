import React, { useEffect, useState } from "react";
import { BedDouble, Building2, ClipboardList, Flame, MapPin, UtensilsCrossed } from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { Panel, PanelState, Stat } from "../../modules/marketplace/ui";
import type { LoadState } from "../../modules/marketplace/ui";
import { hrService } from "../../services/hr.service";
import type { HrLocation } from "../../services/hr.service";
import { leadCollectionService } from "../../services/leadCollection.service";
import { foodPartnerService } from "../../services/foodPartner.service";
import { ashramService, templeService } from "../../services";
import { providerAdminService } from "../../modules/pandit/services/provider.service";

type Counts = { leads?: number; pendingLeads?: number; restaurants?: number; temples?: number; pandits?: number; stays?: number };

/**
 * Home of an HR or Executive login: the office it works from, the area that office covers,
 * and the Leads, Food, Temples, Pandit and Stay sections, each showing only that area's records.
 */
export const HrAreaDashboardPage: React.FC = () => {
  const [location, setLocation] = useState<HrLocation | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [counts, setCounts] = useState<Counts>({});

  useEffect(() => {
    hrService
      .myLocation()
      .then((data) => {
        if (!data) return setState("forbidden");
        setLocation(data);
        setState(data.terms.length ? "ready" : "missing");
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    if (state !== "ready") return;
    // Each count is best effort: a section that fails to load just shows a dash.
    const settle = <T,>(promise: Promise<T>, pick: (value: T) => Counts) =>
      promise.then((value) => setCounts((c) => ({ ...c, ...pick(value) }))).catch(() => undefined);
    settle(leadCollectionService.leadStats(), (res) => ({ leads: res.data.data.total, pendingLeads: res.data.data.pending }));
    settle(foodPartnerService.listVendors({}), (rows) => ({ restaurants: rows.length }));
    settle(templeService.adminList({ limit: 1 }), (res: any) => ({ temples: res.data?.data?.total }));
    settle(providerAdminService.overview(), (res: any) => ({ pandits: res.data?.data?.totalProviders }));
    settle(ashramService.myListings(), (res: any) => ({ stays: res.data?.count ?? res.data?.data?.length }));
  }, [state]);

  const show = (value?: number) => (value === undefined ? "—" : value);

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="My Area Dashboard"
        subtitle={
          location?.terms.length
            ? `${location.officeName} · You manage Leads, Food, Temples, Pandits and Stays in ${location.area}.`
            : "Leads, Food, Temples, Pandits and Stays for the area of your office."
        }
        icon={<MapPin size={20} />}
      />

      {state !== "ready" ? (
        <Panel>
          <PanelState
            state={state}
            missingText="No office is assigned to your account yet, so there is nothing to show. Ask a Super Admin to assign your office (HR Management → HR Accounts, or Executive Management → Executive Accounts)."
          />
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Stat label="Leads" value={show(counts.leads)} hint={counts.pendingLeads ? `${counts.pendingLeads} waiting for review` : undefined} icon={<ClipboardList size={16} />} to="/admin/lead-collection/leads" />
            <Stat label="Restaurants" value={show(counts.restaurants)} icon={<UtensilsCrossed size={16} />} to="/admin/food/vendors" />
            <Stat label="Temples" value={show(counts.temples)} icon={<Building2 size={16} />} to="/admin/temples" />
            <Stat label="Pandits & Acharyas" value={show(counts.pandits)} icon={<Flame size={16} />} to="/admin/pandits/overview" />
            <Stat label="Stays" value={show(counts.stays)} icon={<BedDouble size={16} />} to="/owner/ashrams" />
          </div>
          <Panel title="Your area">
            <p className="text-xs text-gray-600 dark:text-gray-300">
              You see records whose address mentions <span className="font-black">{location!.area}</span>. Anything in another city stays hidden,
              and new restaurants, temples, leads or pandits you add must be in this area. A new stay is added under the owner's own
              Tirvona account (they sign up first as “Individual Stay Owner”). To change your office, ask a Super Admin.
            </p>
          </Panel>
        </>
      )}
    </div>
  );
};

export default HrAreaDashboardPage;

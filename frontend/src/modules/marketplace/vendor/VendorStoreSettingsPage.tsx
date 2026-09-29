import React from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Store } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { Panel, Pill, useAction } from "../ui";
import { RequireStore, StoreProfileForm, VendorStatusBanner } from "./VendorShared";

/** Shop profile + store status (public store page, deactivate). */
export const VendorStoreSettingsPage: React.FC = () => {
  const { busy, run } = useAction();
  return (
    <RequireStore>
      {(vendor, reload) => (
        <div className="space-y-5 max-w-4xl">
          <EnterprisePageHeader
            title="Shop profile"
            subtitle="What customers see on your store page, and how Tirvona reaches you."
            icon={<Store size={20} />}
            actions={
              vendor.status === "active" && (
                <Link
                  to={`/marketplace/store/${vendor.slug}`}
                  target="_blank"
                  className="px-4 py-2 rounded-full border border-gray-200 dark:border-slate-700 text-xs font-extrabold inline-flex items-center gap-1.5 hover:border-[#F28C28]"
                >
                  Public store <ExternalLink size={12} />
                </Link>
              )
            }
          />
          <VendorStatusBanner vendor={vendor} />
          <Panel title="Store details">
            <StoreProfileForm key={vendor._id} vendor={vendor} onSaved={reload} />
          </Panel>
          <Panel title="Store status">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2">
                Current status <Pill status={vendor.status} />
                <span className="text-gray-400">· tirvona.com/marketplace/store/{vendor.slug}</span>
              </span>
              {vendor.status !== "deactivated" && (
                <EnterpriseButton
                  variant="danger"
                  size="sm"
                  loading={busy === "deactivate"}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Deactivate your store? All your products are hidden immediately and the store stops selling. This cannot be undone from the dashboard.",
                      )
                    )
                      run("deactivate", () => vendorApi.deactivate(), reload, "Store deactivated");
                  }}
                >
                  Deactivate store
                </EnterpriseButton>
              )}
            </div>
          </Panel>
        </div>
      )}
    </RequireStore>
  );
};

export default VendorStoreSettingsPage;

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, FileCheck, Landmark, Store, Trash2, XCircle } from "lucide-react";
import { vendorApi } from "../../../services/marketplace.service";
import { EnterprisePageHeader } from "../../../admin/shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../../../admin/shared/components/EnterpriseButton";
import { FileUploader } from "../../../components/FileUploader";
import { Field, Panel, PanelState, Pill, inputClass, shortDate, useAction } from "../ui";
import { BankAccountForm, BankAccountList } from "./VendorBank";
import { StoreProfileForm, VendorStatusBanner, useVendorProfile, type VendorProfile } from "./VendorShared";

const DOCUMENT_TYPES: Array<[string, string]> = [
  ["identity", "Identity proof (Aadhaar / PAN / Passport)"],
  ["address_proof", "Address proof"],
  ["business_registration", "Business registration"],
  ["gst", "GST certificate"],
  ["pan", "Business PAN"],
  ["other", "Other"],
];
const docLabel = (type: string) => DOCUMENT_TYPES.find(([t]) => t === type)?.[1] ?? type;

const Step: React.FC<{ n: number; title: string; done: boolean; icon: React.ReactNode; children: React.ReactNode }> = ({
  n,
  title,
  done,
  icon,
  children,
}) => (
  <Panel
    title={
      <span className="flex items-center gap-2">
        <span
          className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center ${
            done ? "bg-emerald-500 text-white" : "bg-[#F28C28]/10 text-[#F28C28]"
          }`}
        >
          {done ? <CheckCircle2 size={14} /> : n}
        </span>
        <span className="text-[#F28C28]">{icon}</span>
        {title}
      </span>
    }
  >
    {children}
  </Panel>
);

const DocumentsStep: React.FC<{ vendor: VendorProfile; onChange: () => void }> = ({ vendor, onChange }) => {
  const [type, setType] = useState("identity");
  const [fileUrl, setFileUrl] = useState("");
  const [masked, setMasked] = useState("");
  const [uploaderKey, setUploaderKey] = useState(0);
  const { busy, run } = useAction();
  const editable = !["suspended", "deactivated"].includes(vendor.status);

  const add = () =>
    run(
      "add",
      () =>
        vendorApi.addDocument({
          type,
          fileUrl,
          documentNumberMasked: masked.trim() || undefined,
        }),
      () => {
        setFileUrl("");
        setMasked("");
        setUploaderKey((k) => k + 1);
        onChange();
      },
      "Document uploaded",
    );

  return (
    <div className="space-y-4">
      {vendor.missingDocuments && vendor.missingDocuments.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 font-bold">
          Still required: {vendor.missingDocuments.map(docLabel).join(", ")}
        </p>
      )}
      <ul className="divide-y divide-gray-100 dark:divide-slate-800">
        {(vendor.documents ?? []).map((doc) => (
          <li key={doc._id} className="py-2.5 flex flex-wrap items-center gap-3 text-xs">
            <span className="flex-1 min-w-[180px]">
              <span className="font-bold text-[#0B192C] dark:text-white block">{docLabel(doc.type)}</span>
              <span className="text-gray-400">
                {doc.documentNumberMasked ? `${doc.documentNumberMasked} · ` : ""}
                Uploaded {shortDate(doc.createdAt)}
              </span>
              {doc.status === "rejected" && doc.reviewNote && (
                <span className="block text-rose-600 font-semibold">Reviewer note: {doc.reviewNote}</span>
              )}
            </span>
            <Pill status={doc.status} />
            <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="text-[#F28C28] font-bold inline-flex items-center gap-1">
              View <ExternalLink size={11} />
            </a>
            {doc.status !== "verified" && editable && (
              <button
                type="button"
                aria-label={`Remove ${docLabel(doc.type)}`}
                disabled={busy === doc._id}
                onClick={() => run(doc._id, () => vendorApi.removeDocument(doc._id), onChange, "Document removed")}
                className="p-1.5 text-gray-400 hover:text-rose-500 cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </li>
        ))}
        {!vendor.documents?.length && <li className="py-2 text-xs text-gray-400">No documents uploaded yet.</li>}
      </ul>
      {editable && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-gray-100 dark:border-slate-800 pt-4">
          <Field label="Document type" required>
            <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {DOCUMENT_TYPES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Document number (last 4 digits only)" hint="Never enter the full number.">
            <input
              className={inputClass}
              value={masked}
              onChange={(e) => setMasked(e.target.value.replace(/[^0-9A-Za-z]/g, "").slice(-4))}
              placeholder="e.g. 4821"
              maxLength={4}
            />
          </Field>
          <div className="sm:col-span-2">
            <FileUploader
              key={uploaderKey}
              folder="marketplace/vendor-kyc"
              accept="image/*,application/pdf"
              label="Upload document (image or PDF)"
              onUploaded={setFileUrl}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <EnterpriseButton onClick={add} disabled={!fileUrl} loading={busy === "add"}>
              Add document
            </EnterpriseButton>
          </div>
        </div>
      )}
    </div>
  );
};

/** "Become a Seller": create the store, verify it, then go live. */
export const VendorOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: vendor, state, error, reload } = useVendorProfile();
  const { busy, run } = useAction();

  if (state === "loading" || state === "error" || state === "forbidden")
    return <PanelState state={state} error={error} onRetry={reload} />;

  const hasStore = state === "ready" && vendor;
  const docsDone = Boolean(hasStore && !vendor.missingDocuments?.length);
  const submitted = Boolean(hasStore && !["draft", "rejected"].includes(vendor.status));
  const live = vendor?.status === "active";
  const hasBank = Boolean(vendor?.bankAccounts?.length);
  // Same requirements the backend enforces on submit, shown so the seller knows what is missing.
  const missing = vendor?.missingDocuments ?? [];
  const checklist = [
    { label: "Identity proof uploaded", done: !missing.includes("identity"), fix: "upload it in step 2" },
    { label: "Address proof uploaded", done: !missing.includes("address_proof"), fix: "upload it in step 2" },
    { label: "Store city and pincode", done: Boolean(vendor?.address?.city && vendor?.address?.pincode), fix: "add them in step 1 and save" },
    { label: "Contact phone", done: Boolean(vendor?.contactPhone), fix: "add it in step 1 and save" },
  ];
  const readyToSubmit = checklist.every((item) => item.done);

  return (
    <div className="space-y-5 max-w-4xl">
      <EnterprisePageHeader
        title={hasStore ? "Seller verification" : "Sell on Tirvona"}
        subtitle={
          hasStore
            ? "Your documents, verification status and payout account."
            : "Open your store on Tirvona with your existing account. Verified sellers reach pilgrims across India."
        }
        icon={<Store size={20} />}
      />

      {hasStore && <VendorStatusBanner vendor={vendor} showAction={false} />}

      <Step n={1} title="Store profile" done={Boolean(hasStore)} icon={<Store size={14} />}>
        <StoreProfileForm key={vendor?._id ?? "new"} vendor={vendor} onSaved={reload} />
      </Step>

      {hasStore && (
        <>
          <Step n={2} title="Verification documents" done={docsDone} icon={<FileCheck size={14} />}>
            <DocumentsStep vendor={vendor} onChange={reload} />
          </Step>

          <Step n={3} title="Submit for verification" done={submitted} icon={<CheckCircle2 size={14} />}>
            {submitted ? (
              <p className="text-xs text-gray-600 dark:text-gray-300">
                Submitted. Current status: <Pill status={vendor.status} />
              </p>
            ) : (
              <div className="space-y-3 text-xs text-gray-600 dark:text-gray-300">
                <p>
                  A verified document is not the same as a verified shop: Tirvona approves the whole shop once you
                  submit it. Complete everything below to unlock the button.
                </p>
                <ul className="space-y-1.5">
                  {checklist.map((item) => (
                    <li key={item.label} className="flex items-center gap-2">
                      {item.done ? (
                        <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                      ) : (
                        <XCircle size={15} className="text-rose-500 shrink-0" />
                      )}
                      <span className={item.done ? "" : "font-bold text-rose-700 dark:text-rose-400"}>
                        {item.label}
                        {!item.done && ` · ${item.fix}`}
                      </span>
                    </li>
                  ))}
                </ul>
                <EnterpriseButton
                  disabled={!readyToSubmit}
                  loading={busy === "submit"}
                  onClick={() => run("submit", () => vendorApi.submit(), reload, "Submitted for verification")}
                >
                  {vendor.status === "rejected" ? "Resubmit for verification" : "Submit for verification"}
                </EnterpriseButton>
              </div>
            )}
          </Step>

          <Step n={4} title="Payout account and go live" done={live} icon={<Landmark size={14} />}>
            <div className="space-y-4">
              <BankAccountList onChange={reload} />
              {!live && <BankAccountForm onSaved={reload} />}
              {vendor.status === "approved" && (
                <div className="flex flex-wrap items-center gap-3 border-t border-gray-100 dark:border-slate-800 pt-4">
                  <EnterpriseButton
                    variant="success"
                    disabled={!hasBank}
                    loading={busy === "activate"}
                    onClick={() =>
                      run("activate", () => vendorApi.activate(), () => navigate("/vendor/dashboard"), "Your store is live")
                    }
                  >
                    Activate my store
                  </EnterpriseButton>
                  {!hasBank && <span className="text-xs text-gray-500">Add a bank account first.</span>}
                </div>
              )}
              {!["approved", "active"].includes(vendor.status) && (
                <p className="text-xs text-gray-500">You can activate your store once Tirvona approves it.</p>
              )}
            </div>
          </Step>
        </>
      )}
    </div>
  );
};

export default VendorOnboardingPage;

import React, { useEffect, useState } from "react";
import {
  qrQuery,
  smartContactService,
  type QrLayout,
  type SmartContactProfile,
  type SmartContactQr,
  type SmartContactQrFormat,
} from "../../../services/smartContact.service";
import { API_BASE_URL, getErrorMessage, TOKEN_KEY } from "../../../lib/api";
import { toast } from "../../../lib/toast";
import { EnterpriseButton } from "../../shared";
import { Download, Loader2, Plus, QrCode, XCircle } from "lucide-react";

const SOURCES: { value: string; label: string }[] = [
  { value: "business-card", label: "Visiting Card" },
  { value: "id-card", label: "ID Card" },
  { value: "brochure", label: "Brochure" },
  { value: "event", label: "Event Badge" },
  { value: "exhibition", label: "Exhibition" },
  { value: "poster", label: "Poster" },
  { value: "digital", label: "Digital" },
];

const CAPTIONS = [
  { value: "", label: "No caption" },
  { value: "Scan & Save Contact", label: "Scan & Save Contact" },
  { value: "स्कैन करें और संपर्क सेव करें", label: "स्कैन करें और संपर्क सेव करें" },
];

export const QrPanel: React.FC<{
  profile: SmartContactProfile;
  qrCodes: SmartContactQr[];
  onChanged: () => void;
}> = ({ profile, qrCodes, onChanged }) => {
  const [previewSvg, setPreviewSvg] = useState("");
  const [previewLoading, setPreviewLoading] = useState(true);
  const [layout, setLayout] = useState<QrLayout>("card");
  const [caption, setCaption] = useState("Scan & Save Contact");
  const [frame, setFrame] = useState(true);
  const [logo, setLogo] = useState(false);
  const [photo, setPhoto] = useState(true);
  const [source, setSource] = useState("business-card");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPreviewLoading(true);

    const query = qrQuery({ layout, caption, frame, logo, photo });

    fetch(
      `${API_BASE_URL}/api/v1/admin/smart-contacts/${profile.id}/qr-preview/svg${query}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) ?? ""}`,
        },
      },
    )
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("failed"))))
      .then((svg) => {
        if (!cancelled) setPreviewSvg(svg);
      })
      .catch(() => {
        if (!cancelled) setPreviewSvg("");
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [profile.id, layout, caption, frame, logo, photo]);

  const download = async (
    format: SmartContactQrFormat,
    qrId?: string,
    size?: number,
    forceLayout?: QrLayout,
  ) => {
    const key = `${qrId ?? "preview"}-${format}-${size ?? ""}`;
    setDownloading(key);
    try {
      const options = {
        layout: forceLayout ?? layout,
        caption,
        frame,
        logo,
        photo,
        size,
      };
      if (qrId) {
        await smartContactService.downloadAsset(
          profile.id,
          qrId,
          format,
          profile.slug,
          options,
        );
      } else {
        await smartContactService.downloadPreview(
          profile.id,
          format,
          profile.slug,
          options,
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not download the QR artwork."));
    } finally {
      setDownloading("");
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      await smartContactService.generateQr(profile.id, {
        source,
        formats: ["svg", "png", "pdf"],
        label: label.trim() || undefined,
      });
      toast.success("QR asset registered");
      setLabel("");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not register the QR asset."));
    } finally {
      setBusy(false);
    }
  };

  const retire = async (qrId: string) => {
    try {
      await smartContactService.retireQr(profile.id, qrId);
      toast.success("QR asset retired");
      onChanged();
    } catch (err) {
      toast.error(getErrorMessage(err, "Could not retire this QR asset."));
    }
  };

  const controlClass =
    "px-3 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-[#0B192C] dark:text-white focus:outline-none focus:border-[#0A4DA6]";

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm space-y-4">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6]">
          Preview & download
        </h4>

        <div className="flex gap-2">
          {(
            [
              ["card", "Contact Card", "Identity + QR, print-ready"],
              ["qr", "QR Only", "Bare symbol for your own layout"],
            ] as [QrLayout, string, string][]
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => setLayout(value)}
              className={`flex-1 px-3 py-2 rounded-xl border text-left transition-colors ${
                layout === value
                  ? "bg-[#0A4DA6] text-white border-[#0A4DA6]"
                  : "bg-white dark:bg-[#0B192C] text-[#0B192C] dark:text-white border-gray-200 dark:border-slate-800 hover:border-[#0A4DA6]"
              }`}
            >
              <span className="block text-xs font-black">{label}</span>
              <span
                className={`block text-[10px] ${layout === value ? "opacity-80" : "text-gray-400"}`}
              >
                {hint}
              </span>
            </button>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-4 grid place-items-center min-h-[260px]">
          {previewLoading ? (
            <Loader2 size={24} className="animate-spin text-gray-300" />
          ) : previewSvg ? (
            <div
              className="w-full max-w-[240px] [&>svg]:w-full [&>svg]:h-auto"
              dangerouslySetInnerHTML={{ __html: previewSvg }}
            />
          ) : (
            <p className="text-xs font-bold text-gray-400">
              Could not render the preview.
            </p>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 block">
              Caption
            </label>
            <select
              className={controlClass}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            >
              {CAPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 pt-5">
            {layout === "card" ? (
              <label className="flex items-center gap-2 text-[11px] font-bold text-[#0B192C] dark:text-white">
                <input
                  type="checkbox"
                  checked={photo}
                  onChange={(e) => setPhoto(e.target.checked)}
                />
                Photograph (SVG only)
              </label>
            ) : (
              <>
                <label className="flex items-center gap-2 text-[11px] font-bold text-[#0B192C] dark:text-white">
                  <input
                    type="checkbox"
                    checked={frame}
                    onChange={(e) => setFrame(e.target.checked)}
                  />
                  Gold accent frame
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-[#0B192C] dark:text-white">
                  <input
                    type="checkbox"
                    checked={logo}
                    onChange={(e) => setLogo(e.target.checked)}
                  />
                  Centre logo (SVG only)
                </label>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <EnterpriseButton
            variant="outline"
            disabled={downloading !== ""}
            onClick={() => void download("svg")}
          >
            <Download size={14} /> SVG
          </EnterpriseButton>
          {layout === "qr" && (
            <>
              <EnterpriseButton
                variant="outline"
                disabled={downloading !== ""}
                onClick={() => void download("png", undefined, 1000)}
              >
                <Download size={14} /> PNG 1000px
              </EnterpriseButton>
              <EnterpriseButton
                variant="outline"
                disabled={downloading !== ""}
                onClick={() => void download("png", undefined, 2000)}
              >
                <Download size={14} /> PNG 2000px
              </EnterpriseButton>
            </>
          )}
          <EnterpriseButton
            variant="outline"
            disabled={downloading !== ""}
            onClick={() => void download("pdf")}
          >
            <Download size={14} /> PDF
          </EnterpriseButton>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          {layout === "card" ? (
            <>
              An 88 × 55 mm visiting card carrying the name, designation, role
              line and contact details alongside the QR — hand it straight to a
              printer. SVG and PDF only: both are vector, which is what a
              printer wants, and flattening the layout to PNG would need a
              server-side SVG renderer. The photograph and non-Latin text are
              SVG-only, since the PDF uses standard fonts.
              <strong className="block mt-1 text-gray-500">
                The QR still encodes only the profile URL. Details printed on
                the card are fixed at print time — editing them later updates
                the contact page, not the card in someone&rsquo;s pocket.
              </strong>
            </>
          ) : (
            <>
              The bare symbol, for dropping into a card design you already have.
              SVG is the master print format. The centre logo and the Hindi
              caption are SVG-only — the PNG stays unbranded for scan
              reliability, and the PDF uses a standard font with no Devanagari
              glyphs. Error correction is level H on every format.
            </>
          )}
        </p>
      </div>

      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[28px] p-5 shadow-sm space-y-4">
        <h4 className="text-[11px] font-black uppercase tracking-wider text-[#0A4DA6]">
          Tracked QR assets
        </h4>
        <p className="text-[10px] text-gray-400 -mt-2">
          Register one per placement so scans can be attributed to the card,
          badge or brochure they came from. All of them point at the same
          permanent profile URL.
        </p>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-black text-gray-500 block">
              Placement
            </label>
            <select
              className={controlClass}
              value={source}
              onChange={(e) => setSource(e.target.value)}
            >
              {SOURCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className="text-[11px] font-black text-gray-500 block">
              Label (optional)
            </label>
            <input
              className={controlClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Kumbh 2026 print run"
            />
          </div>
          <EnterpriseButton disabled={busy} onClick={() => void generate()}>
            {busy ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Plus size={14} />
            )}
            Generate
          </EnterpriseButton>
        </div>

        {qrCodes.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <QrCode size={26} className="mx-auto text-gray-300" />
            <p className="text-xs font-bold text-gray-500">
              No tracked QR assets yet.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {qrCodes.map((qr) => (
              <div
                key={qr.id}
                className="p-3 rounded-2xl border border-gray-100 dark:border-slate-800 flex flex-wrap items-center gap-3 justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-[#0B192C] dark:text-white">
                    {qr.qrIdentifier}
                    {qr.status === "RETIRED" && (
                      <span className="ml-2 text-[10px] font-bold text-gray-400">
                        retired
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">
                    {qr.source} · {qr.destinationUrl}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {(layout === "card"
                    ? (["svg", "pdf"] as SmartContactQrFormat[])
                    : (["svg", "png", "pdf"] as SmartContactQrFormat[])
                  ).map(
                    (format) => (
                      <button
                        key={format}
                        type="button"
                        disabled={downloading !== ""}
                        onClick={() =>
                          void download(
                            format,
                            qr.id,
                            format === "png" ? 1000 : undefined,
                          )
                        }
                        className="px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-gray-200 dark:border-slate-700 text-[#0B192C] dark:text-white hover:border-[#0A4DA6] hover:text-[#0A4DA6] disabled:opacity-50"
                      >
                        {format}
                      </button>
                    ),
                  )}
                  {qr.status !== "RETIRED" && (
                    <button
                      type="button"
                      onClick={() => void retire(qr.id)}
                      title="Retire this placement"
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

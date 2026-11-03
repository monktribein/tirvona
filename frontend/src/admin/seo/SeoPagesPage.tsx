import React, { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Globe, Plus, Search, Send, ShieldCheck, Undo2, UploadCloud, Archive } from "lucide-react";
import { EnterprisePageHeader } from "../shared/components/EnterprisePageHeader";
import { EnterpriseButton } from "../shared/components/EnterpriseButton";
import { EnterpriseModal } from "../shared/components/EnterpriseModal";
import {
  Chips,
  Empty,
  Field,
  inputClass,
  Panel,
  PanelState,
  Pill,
  ResponsiveTable,
  askReason,
  dateTime,
  shortDate,
  useAction,
  useRemote,
} from "../../modules/marketplace/ui";
import {
  seoService,
  type SeoAction,
  type SeoCapabilities,
  type SeoHistoryEntry,
  type SeoPageInput,
  type SeoPageRecord,
} from "../../services/seo.service";

const FILTERS = [
  { value: "", label: "All" },
  { value: "review", label: "Needs review" },
  { value: "draft", label: "Drafts" },
  { value: "in_review", label: "In review" },
  { value: "approved", label: "Approved" },
  { value: "published", label: "Published" },
  { value: "retired", label: "Retired" },
];

const STAGE_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "In review",
  approved: "Approved",
  published: "Published",
  retired: "Retired",
};

const HISTORY_LABEL: Record<string, string> = {
  SEO_PAGE_CREATED: "Created",
  SEO_PAGE_EDITED: "Edited",
  SEO_PAGE_SUBMITTED: "Submitted for review",
  SEO_PAGE_VERIFIED: "Facts verified",
  SEO_PAGE_APPROVED: "Approved",
  SEO_PAGE_REJECTED: "Sent back",
  SEO_PAGE_PUBLISHED: "Published",
  SEO_PAGE_RETIRED: "Retired",
};

const LIMITS = { seoTitle: [70, 30, 65], metaDescription: [170, 70, 160], h1: [120, 0, 120] } as const;

/** "{len}/{max}", amber outside the recommended range and red past the limit. */
const Counter: React.FC<{ value: string; field: keyof typeof LIMITS }> = ({ value, field }) => {
  const [max, low, high] = LIMITS[field];
  const len = value.trim().length;
  const tone = len > max ? "text-rose-600" : len && (len < low || len > high) ? "text-amber-600" : "text-gray-400";
  return <span className={`text-[10px] font-bold ${tone}`}>{len}/{max}</span>;
};

const jsonText = (value: unknown) => (value == null ? "" : JSON.stringify(value, null, 2));

/** Parses an optional JSON box; "" clears it. Throws a readable message. */
const parseJson = (text: string, label: string): unknown => {
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
};

interface FormState {
  path: string;
  landing: boolean;
  seoTitle: string;
  metaDescription: string;
  h1: string;
  indexingStatus: "index" | "noindex";
  schemaText: string;
  contentText: string;
  legacyWpId: string;
}

const emptyForm: FormState = {
  path: "",
  landing: false,
  seoTitle: "",
  metaDescription: "",
  h1: "",
  indexingStatus: "index",
  schemaText: "",
  contentText: "",
  legacyWpId: "",
};

/** The values being edited: a published page's revision if it has one, otherwise the row itself. */
const formFrom = (page: SeoPageRecord): FormState => {
  const source = page.publicationStatus === "published" && page.pending ? page.pending : page;
  return {
    path: page.path,
    landing: page.pageType === "landing",
    seoTitle: source.seoTitle ?? "",
    metaDescription: source.metaDescription ?? "",
    h1: source.h1 ?? "",
    indexingStatus: source.indexingStatus ?? "index",
    schemaText: jsonText(source.schemaJson),
    contentText: jsonText(source.contentJson),
    legacyWpId: page.legacyWpId ?? "",
  };
};

/**
 * SEO publishing: editorial title, description, H1, indexing and JSON-LD additions for public
 * pages, published only after review (writer → fact check → approval → publish). Each button
 * appears only for people who hold that step's seo.pages.* permission; the API checks again.
 */
const SeoPagesPage: React.FC = () => {
  const [filter, setFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null | undefined>(undefined); // null = new record

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(
    () => (filter === "review" ? { queue: "review", q: search } : { status: filter, q: search }),
    [filter, search],
  );
  const { data, state, error, reload } = useRemote<{ rows: SeoPageRecord[]; capabilities: SeoCapabilities }>(
    () => seoService.list(params),
    [params],
  );
  const rows = data?.rows ?? [];
  const can = data?.capabilities;

  return (
    <div className="space-y-5">
      <EnterprisePageHeader
        title="SEO pages"
        subtitle="The title, description and headline search engines show for a public page. Changes go live only after review and publishing."
        icon={<Globe size={20} />}
        actions={
          can?.edit ? (
            <EnterpriseButton icon={<Plus size={14} />} onClick={() => setOpenId(null)}>
              New SEO record
            </EnterpriseButton>
          ) : undefined
        }
      />
      <Panel>
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
            <Chips value={filter} options={FILTERS} onChange={setFilter} />
            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search path, title or H1…"
                className={`${inputClass} pl-8`}
              />
            </div>
          </div>
          {state !== "ready" ? (
            <PanelState state={state} error={error} onRetry={reload} />
          ) : !rows.length ? (
            <Empty title="No SEO records" text={search ? "Nothing matches that search." : "Pages use their generated titles until an SEO record is published."} />
          ) : (
            <ResponsiveTable
              rows={rows}
              rowKey={(r) => r.id}
              onRowClick={(r) => setOpenId(r.id)}
              columns={[
                {
                  header: "Page",
                  cell: (r) => (
                    <div className="min-w-0">
                      <div className="font-bold text-[#0B192C] dark:text-white truncate">{r.path}</div>
                      <div className="text-[10px] text-gray-400">{r.pageType}</div>
                    </div>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) => (
                    <div className="flex flex-wrap gap-1">
                      <Pill status={r.publicationStatus} label={STAGE_LABEL[r.publicationStatus]} />
                      {r.pending && <Pill tone="amber" label={`Revision: ${STAGE_LABEL[r.pending.stage]}`} />}
                      {r.indexingStatus === "noindex" && <Pill tone="gray" label="noindex" />}
                    </div>
                  ),
                },
                { header: "SEO title", cell: (r) => <span className="line-clamp-2">{r.seoTitle ?? "—"}</span>, hideOnMobile: true },
                { header: "Updated", cell: (r) => shortDate(r.updatedAt), hideOnMobile: true },
              ]}
            />
          )}
        </div>
      </Panel>
      {openId !== undefined && can && (
        <SeoEditor
          id={openId}
          can={can}
          onClose={() => setOpenId(undefined)}
          onChanged={(page) => {
            if (page && openId === null) setOpenId(page.id);
            return reload();
          }}
        />
      )}
    </div>
  );
};

const SeoEditor: React.FC<{
  id: string | null;
  can: SeoCapabilities;
  onClose: () => void;
  onChanged: (page?: SeoPageRecord) => unknown;
}> = ({ id, can, onClose, onChanged }) => {
  const [page, setPage] = useState<SeoPageRecord | null>(null);
  const [history, setHistory] = useState<SeoHistoryEntry[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const { busy, run } = useAction();

  const load = async (pageId: string) => {
    const res = await seoService.get(pageId);
    const detail = res.data.data as { page: SeoPageRecord; history: SeoHistoryEntry[] };
    setPage(detail.page);
    setHistory(detail.history);
    setForm(formFrom(detail.page));
  };

  useEffect(() => {
    if (id) load(id).catch(() => onClose());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const isNew = !page;
  const retired = page?.publicationStatus === "retired";
  const fixedPage = page ? ["static", "landing"].includes(page.pageType) : true;
  const editable = can.edit && !retired;

  const save = () => {
    setFormError("");
    let body: SeoPageInput;
    try {
      body = {
        seoTitle: form.seoTitle,
        metaDescription: form.metaDescription,
        h1: form.h1,
        indexingStatus: form.indexingStatus,
        schemaJson: parseJson(form.schemaText, "Schema additions"),
        legacyWpId: form.legacyWpId,
        ...(fixedPage ? { contentJson: parseJson(form.contentText, "Page copy") } : {}),
      };
    } catch (err) {
      setFormError((err as Error).message);
      return;
    }
    return run(
      "save",
      async () => {
        const res = isNew
          ? await seoService.create({ ...body, path: form.path.trim(), ...(form.landing ? { pageType: "landing" } : {}) })
          : await seoService.update(page.id, { ...body, version: page.version });
        const result = res.data.data as { page: SeoPageRecord; warnings: string[] };
        setWarnings(result.warnings ?? []);
        await load(result.page.id);
        await onChanged(result.page);
      },
      undefined,
      page?.publicationStatus === "published" ? "Saved as a revision; the live page is unchanged until it is published." : "Saved.",
    );
  };

  const act = async (action: SeoAction, extra: { comment?: string; redirectTo?: string | null } = {}) => {
    if (!page) return;
    await run(
      action,
      async () => {
        const res = await seoService.act(page.id, action, { version: page.version, ...extra });
        setWarnings((res.data.data as { warnings?: string[] }).warnings ?? []);
        await load(page.id);
        await onChanged();
      },
      undefined,
      {
        submit: "Submitted for review.",
        verify: "Facts marked as verified.",
        approve: "Approved.",
        reject: "Sent back to the writer.",
        publish: "Published. Search engines see it on their next visit.",
        retire: "Retired.",
      }[action],
    );
  };

  const stage = page?.stage ?? "draft";
  const verifiedAt = page ? (page.publicationStatus === "published" && page.pending ? page.pending.verifiedAt : page.verifiedAt) : null;

  return (
    <EnterpriseModal
      isOpen
      onClose={onClose}
      title={isNew ? "New SEO record" : page.path}
      subtitle={isNew ? "For a public page that search engines index" : `${page.pageType} · ${STAGE_LABEL[page.publicationStatus]}`}
      icon={<Globe size={18} />}
      maxWidth="3xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2 w-full">
          {page && can.edit && stage === "draft" && !retired && (
            <EnterpriseButton variant="outline" icon={<Send size={14} />} loading={busy === "submit"} onClick={() => act("submit")}>
              Submit for review
            </EnterpriseButton>
          )}
          {page && can.verify && stage === "in_review" && !verifiedAt && (
            <EnterpriseButton variant="outline" icon={<ShieldCheck size={14} />} loading={busy === "verify"} onClick={() => act("verify")}>
              Facts verified
            </EnterpriseButton>
          )}
          {page && can.approve && ["in_review", "approved"].includes(stage) && (
            <EnterpriseButton
              variant="ghost"
              icon={<Undo2 size={14} />}
              loading={busy === "reject"}
              onClick={() => {
                const comment = askReason("What needs to change?", 3);
                if (comment) act("reject", { comment });
              }}
            >
              Send back
            </EnterpriseButton>
          )}
          {page && can.approve && stage === "in_review" && verifiedAt && (
            <EnterpriseButton variant="success" icon={<CheckCircle2 size={14} />} loading={busy === "approve"} onClick={() => act("approve")}>
              Approve
            </EnterpriseButton>
          )}
          {page && can.publish && stage === "approved" && (
            <EnterpriseButton icon={<UploadCloud size={14} />} loading={busy === "publish"} onClick={() => act("publish")}>
              Publish
            </EnterpriseButton>
          )}
          {page && can.retire && page.publicationStatus === "published" && (
            <EnterpriseButton
              variant="danger"
              icon={<Archive size={14} />}
              loading={busy === "retire"}
              onClick={() => {
                const target = window.prompt("Retire this page. Send visitors to (a site path such as /temples), or leave empty for 'gone' (410):");
                if (target !== null) act("retire", { redirectTo: target.trim() || null });
              }}
            >
              Retire
            </EnterpriseButton>
          )}
          {editable && (
            <EnterpriseButton variant="secondary" loading={busy === "save"} onClick={save}>
              {isNew ? "Create draft" : page.publicationStatus === "published" ? "Save revision" : "Save draft"}
            </EnterpriseButton>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        {page?.publicationStatus === "published" && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 dark:bg-emerald-950/30 dark:border-emerald-900 p-3 text-xs space-y-1">
            <div className="font-black text-emerald-800 dark:text-emerald-300">Live now (published {dateTime(page.publishedAt)})</div>
            <div><b>Title:</b> {page.seoTitle ?? "generated"}</div>
            <div><b>Description:</b> {page.metaDescription ?? "generated"}</div>
            <div><b>H1:</b> {page.h1 ?? "generated"}</div>
            {page.pending && <div className="text-amber-700 dark:text-amber-400 font-bold">A revision is in progress ({STAGE_LABEL[page.pending.stage]}); edits below change the revision, not the live page.</div>}
          </div>
        )}
        {retired && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 p-3 text-xs">
            Retired {dateTime(page?.retiredAt)} — {page?.redirectTo ? `visitors are sent to ${page.redirectTo} (301)` : "the page answers 410 (gone)"}.
          </div>
        )}

        {isNew && (
          <>
            <Field label="Page path" required hint="The page's own address, lowercase, e.g. /temples/banke-bihari or /stays-near-prem-mandir-vrindavan.">
              <input value={form.path} onChange={(e) => set("path", e.target.value)} placeholder="/temples/…" className={inputClass} />
            </Field>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={form.landing} onChange={(e) => set("landing", e.target.checked)} />
              This fixed page is a search landing page
            </label>
          </>
        )}

        <Field label="SEO title" hint="Shown as the headline in search results. Leave empty to keep the generated title. Best 30–65 characters.">
          <div className="relative">
            <input value={form.seoTitle} disabled={!editable} onChange={(e) => set("seoTitle", e.target.value)} className={`${inputClass} pr-14`} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2"><Counter value={form.seoTitle} field="seoTitle" /></span>
          </div>
        </Field>
        <Field label="Meta description" hint="The summary under the title in search results. Best 70–160 characters.">
          <div className="relative">
            <textarea rows={3} value={form.metaDescription} disabled={!editable} onChange={(e) => set("metaDescription", e.target.value)} className={`${inputClass} pr-14`} />
            <span className="absolute right-3 bottom-2"><Counter value={form.metaDescription} field="metaDescription" /></span>
          </div>
        </Field>
        <div className="grid sm:grid-cols-[1fr_180px] gap-3">
          <Field label="H1 (page headline)" hint="Used in the server-rendered page that search engines read first.">
            <div className="relative">
              <input value={form.h1} disabled={!editable} onChange={(e) => set("h1", e.target.value)} className={`${inputClass} pr-14`} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2"><Counter value={form.h1} field="h1" /></span>
            </div>
          </Field>
          <Field label="Search engines">
            <select value={form.indexingStatus} disabled={!editable} onChange={(e) => set("indexingStatus", e.target.value as FormState["indexingStatus"])} className={inputClass}>
              <option value="index">Index this page</option>
              <option value="noindex">Do not index (noindex)</option>
            </select>
          </Field>
        </div>
        <Field label="Schema additions (JSON-LD)" hint='Optional FAQPage, HowTo or Event blocks, e.g. {"@context":"https://schema.org","@type":"FAQPage",...}. No ratings or reviews; links only to www.tirvona.com.'>
          <textarea rows={5} value={form.schemaText} disabled={!editable} onChange={(e) => set("schemaText", e.target.value)} className={`${inputClass} font-mono`} />
        </Field>
        {fixedPage && (
          <Field label="Page copy (JSON)" hint='Fixed and landing pages only: {"intro":"…","sections":[{"heading":"…","body":"…"}],"faq":[{"question":"…","answer":"…"}]}. Stored for editors; the page text in code is unchanged.'>
            <textarea rows={4} value={form.contentText} disabled={!editable} onChange={(e) => set("contentText", e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
        )}
        <Field label="WordPress post id" hint="Optional: the old WordPress post this page replaces.">
          <input value={form.legacyWpId} disabled={!editable} onChange={(e) => set("legacyWpId", e.target.value)} className={inputClass} />
        </Field>

        {formError && <div className="text-xs font-bold text-rose-600">{formError}</div>}
        {warnings.length > 0 && (
          <ul className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 list-disc pl-4 space-y-0.5">
            {warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        )}

        {page && (
          <div className="rounded-2xl border border-gray-100 dark:border-slate-800 p-3 text-xs space-y-2">
            <div className="flex flex-wrap gap-2 items-center">
              <span className="font-black text-[#0B192C] dark:text-white">Review</span>
              <Pill status={stage === "in_review" ? "under_review" : stage} label={STAGE_LABEL[stage] ?? stage} />
              {verifiedAt ? <Pill tone="green" label={`Facts verified ${shortDate(verifiedAt)}`} /> : <Pill tone="gray" label="Facts not verified" />}
            </div>
            {history.length > 0 && (
              <ol className="space-y-1 text-[11px] text-gray-500 dark:text-gray-400">
                {history.map((h, i) => (
                  <li key={`${h.action}-${i}`}>
                    <b className="text-gray-700 dark:text-gray-200">{HISTORY_LABEL[h.action] ?? h.action}</b> · {dateTime(h.at)}
                    {h.comment && <span> — “{h.comment}”</span>}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </EnterpriseModal>
  );
};

export default SeoPagesPage;

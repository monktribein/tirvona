"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Users,
  Search,
  ArrowRight,
  Filter,
  Check,
  X,
  AlertCircle,
} from "lucide-react";
import { panditService } from "../../services/pandit.service";
import type {
  VerificationCase,
  ProviderProfile,
} from "../../types/pandit.types";
import {
  PROVIDER_TYPE_LABELS,
  VERIFICATION_LEVEL_LABELS,
} from "../../types/pandit.types";

export default function AdminPortalPage() {
  const [cases, setCases] = useState<VerificationCase[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<VerificationCase | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [submittingDecision, setSubmittingDecision] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [caseRes, provRes] = await Promise.all([
        panditService.getVerificationCases(),
        panditService.listProviders(),
      ]);
      if (caseRes.data?.success) {
        setCases(caseRes.data.data || []);
      }
      if (provRes.data?.success) {
        setProviders(provRes.data.data || []);
      }
    } catch (err) {
      console.error("Admin data load error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (caseId: string, decision: "APPROVE" | "REJECT") => {
    try {
      setSubmittingDecision(true);
      const res = await panditService.decideVerification(caseId, {
        decision,
        note: decisionNote || `Verified and ${decision.toLowerCase()}d by Tirvona Admin.`,
      });
      if (res.data?.success) {
        setToastMessage(`Case ${caseId} marked as ${decision}D!`);
        setSelectedCase(null);
        setDecisionNote("");
        await loadData();
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err) {
      console.error("Failed to submit decision", err);
    } finally {
      setSubmittingDecision(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* ── Admin Header Banner ──────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-[#071322] via-[#0A4DA6] to-[#071322] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-amber-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={14} />
            Tirvona Admin Console
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-serif tracking-tight">
            Vedic Provider Verification & Directory Ops
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/80">
            Review priest certificates, decide credential authenticity, and monitor active Vedic scholars.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md text-center">
            <div className="text-2xl font-extrabold">{cases.length}</div>
            <div className="text-[10px] uppercase font-bold text-blue-200">Total Cases</div>
          </div>
          <div className="p-4 rounded-2xl bg-white/10 backdrop-blur-md text-center">
            <div className="text-2xl font-extrabold">{providers.length}</div>
            <div className="text-[10px] uppercase font-bold text-blue-200">Pandits Listed</div>
          </div>
        </div>
      </div>

      {toastMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500 text-white font-bold text-sm shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* ── 2 Main Sections: Verification Cases & Provider Oversight ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Verification Queue (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-[#0A4DA6]" />
                Verification Review Queue
              </h2>
              <p className="text-xs text-gray-500">
                Incoming priest credentials and Vedic lineage verification requests
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] text-xs font-bold">
              {cases.length} Requests
            </span>
          </div>

          {loading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-24 bg-gray-100 dark:bg-slate-900 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : cases.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-xs">
              No verification cases currently queued.
            </div>
          ) : (
            <div className="space-y-4">
              {cases.map((c) => (
                <div
                  key={c.id}
                  className="p-5 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-gray-500">Case ID: {c.id}</span>
                      <h4 className="text-sm font-bold text-[#0B192C] dark:text-white">
                        Provider ID: {c.providerId}
                      </h4>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        c.status === "APPROVED"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20"
                          : c.status === "REJECTED"
                          ? "bg-rose-50 text-rose-600 border border-rose-500/20"
                          : "bg-amber-50 text-amber-600 border border-amber-500/20"
                      }`}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </div>

                  {c.reviewNote && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-slate-800/60 p-3 rounded-xl border border-gray-100 dark:border-slate-800">
                      <strong>Admin Note:</strong> {c.reviewNote}
                    </p>
                  )}

                  {/* Evidence list */}
                  {c.evidence && c.evidence.length > 0 && (
                    <div className="text-xs space-y-1">
                      <span className="font-semibold text-gray-500">Evidence Uploads:</span>
                      <div className="flex flex-wrap gap-2">
                        {c.evidence.map((ev) => (
                          <span
                            key={ev.id}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] dark:text-blue-300 font-semibold"
                          >
                            {ev.documentType}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action decisions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => handleDecision(c.id, "APPROVE")}
                      disabled={submittingDecision || c.status === "APPROVED"}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Check size={14} />
                      Approve Credentials
                    </button>
                    <button
                      onClick={() => handleDecision(c.id, "REJECT")}
                      disabled={submittingDecision || c.status === "REJECTED"}
                      className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <X size={14} />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Directory Management (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-bold text-[#0B192C] dark:text-white flex items-center gap-2">
                <Users size={18} className="text-[#0A4DA6]" />
                Registered Providers
              </h2>
              <p className="text-xs text-gray-500">
                Full directory of Pandits, Purohits & Jyotishis
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/40 flex items-center justify-between gap-3"
              >
                <div>
                  <h4 className="text-sm font-bold text-[#0B192C] dark:text-white">
                    {p.displayName}
                  </h4>
                  <div className="text-[11px] text-gray-500 flex items-center gap-2">
                    <span>{PROVIDER_TYPE_LABELS[p.providerType]}</span>
                    <span>•</span>
                    <span className="text-emerald-600 font-semibold">
                      {VERIFICATION_LEVEL_LABELS[p.verificationLevel]}
                    </span>
                  </div>
                </div>

                <Link
                  href={`/pandit/${p.id}`}
                  className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-[#0A4DA6] hover:bg-blue-100 transition"
                  title="View Public Profile"
                >
                  <ArrowRight size={15} />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

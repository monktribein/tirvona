"use client";

import React, { useState } from "react";
import {
  BookOpen,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Package,
} from "lucide-react";
import { usePanditOfferings } from "../../../hooks/usePanditProvider";
import { OfferingCard } from "../../../components/OfferingCard";
import { OfferingFormModal } from "../../../components/OfferingFormModal";
import { panditService } from "../../../services/pandit.service";
import type { Offering, OfferingInput } from "../../../types/pandit.types";

export default function OfferingsPage() {
  const { offerings, loading, error, refresh } = usePanditOfferings(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingOffering, setEditingOffering] = useState<Offering | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingOffering(null);
    setModalOpen(true);
  };

  const openEdit = (offering: Offering) => {
    setEditingOffering(offering);
    setModalOpen(true);
  };

  const handleSave = async (data: OfferingInput, id?: string) => {
    setSaving(true);
    try {
      if (id) {
        await panditService.updateOffering(id, data);
      } else {
        await panditService.createOffering(data);
      }
      setModalOpen(false);
      setEditingOffering(null);
      refresh();
    } catch (_err) {
      // API toast interceptor shows the error message
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-2 text-sm text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        Loading offerings...
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-lg mx-auto mt-10 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-[18px] p-8 text-center">
        <AlertCircle size={32} className="text-rose-400 mx-auto mb-3" />
        <h2 className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
          Failed to Load Offerings
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{error}</p>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
        >
          <RefreshCw size={12} />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-[#0B192C] dark:text-white flex items-center gap-2">
              <BookOpen size={16} className="text-[#0A4DA6]" />
              Puja & Consultation Offerings
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Services and rituals available for booking on Tirvona.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
          >
            <Plus size={13} />
            Add Offering
          </button>
        </div>
      </div>

      {/* Offerings list */}
      {offerings.length === 0 ? (
        <div className="bg-white dark:bg-[#0B192C] border border-gray-100 dark:border-slate-800 rounded-[18px] p-12 text-center">
          <div className="w-12 h-12 rounded-full bg-[#0A4DA6]/10 flex items-center justify-center mx-auto mb-3">
            <Package size={22} className="text-[#0A4DA6]" />
          </div>
          <p className="text-sm font-semibold text-[#0B192C] dark:text-white mb-1">
            No offerings yet
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Add your first puja or consultation service to start receiving bookings.
          </p>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0A4DA6] text-white text-xs font-semibold hover:bg-[#083b80] transition cursor-pointer"
          >
            <Plus size={12} />
            Add Offering
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {offerings.map((offering) => (
            <OfferingCard
              key={offering.id}
              offering={offering}
              onEdit={openEdit}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <OfferingFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingOffering(null);
        }}
        onSave={handleSave}
        offering={editingOffering}
        saving={saving}
      />
    </div>
  );
}

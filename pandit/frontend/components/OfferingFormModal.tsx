import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { BookOpen, Clock, Tag, FileText } from "lucide-react";
import { EnterpriseModal } from "./EnterpriseModal";
import { EnterpriseButton } from "./EnterpriseButton";
import type { Offering, OfferingInput } from "../types/pandit.types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  offering: Offering | null; // null = create mode
  onSave: (data: OfferingInput, id?: string) => Promise<void>;
  saving: boolean;
}

interface FormValues {
  name: string;
  description: string;
  durationMinutes: string;
  tagsRaw: string; // comma-separated
}

const inputCls =
  "w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-[#0B192C] dark:text-white px-3 py-2.5 outline-none focus:border-[#0A4DA6] focus:ring-2 focus:ring-[#0A4DA6]/10 transition placeholder:text-gray-400";

export const OfferingFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  offering,
  onSave,
  saving,
}) => {
  const isEdit = Boolean(offering);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      description: "",
      durationMinutes: "",
      tagsRaw: "",
    },
  });

  // Reset when modal opens/offering changes
  useEffect(() => {
    if (isOpen) {
      reset({
        name: offering?.name ?? "",
        description: offering?.description ?? "",
        durationMinutes: offering?.durationMinutes
          ? String(offering.durationMinutes)
          : "",
        tagsRaw: offering?.tags?.join(", ") ?? "",
      });
    }
  }, [isOpen, offering, reset]);

  const onSubmit = async (values: FormValues) => {
    const tags = values.tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: OfferingInput = {
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      durationMinutes: values.durationMinutes
        ? Number(values.durationMinutes)
        : undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    await onSave(payload, offering?.id);
  };

  return (
    <EnterpriseModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Offering" : "Add Offering"}
      subtitle={
        isEdit
          ? "Update service/ritual details"
          : "Add a new puja or ritual service"
      }
      icon={<BookOpen size={18} className="text-[#0A4DA6]" />}
      maxWidth="md"
      footer={
        <div className="flex flex-col sm:flex-row gap-2">
          <EnterpriseButton
            type="submit"
            form="offering-form"
            variant="primary"
            loading={saving}
            disabled={saving}
            className="flex-1"
          >
            {isEdit ? "Update Offering" : "Add Offering"}
          </EnterpriseButton>
          <EnterpriseButton
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
            className="flex-1"
          >
            Cancel
          </EnterpriseButton>
        </div>
      }
    >
      <form id="offering-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <BookOpen size={11} />
            Service / Ritual Name <span className="text-rose-500">*</span>
          </label>
          <input
            {...register("name", {
              required: "Service name is required",
              minLength: { value: 2, message: "Minimum 2 characters" },
              maxLength: { value: 100, message: "Maximum 100 characters" },
            })}
            placeholder="e.g. Satyanarayan Katha, Grih Pravesh Puja"
            className={`${inputCls} ${errors.name ? "border-rose-500" : ""}`}
          />
          {errors.name && (
            <p className="text-[11px] text-rose-500 mt-1">
              {errors.name.message}
            </p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
            <FileText size={11} />
            Description
          </label>
          <textarea
            {...register("description", {
              maxLength: { value: 500, message: "Max 500 characters" },
            })}
            rows={3}
            placeholder="Brief description of what this puja/ritual includes..."
            className={`${inputCls} resize-none`}
          />
          {errors.description && (
            <p className="text-[11px] text-rose-500 mt-1">
              {errors.description.message}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Duration */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              <Clock size={11} />
              Duration (minutes)
            </label>
            <input
              {...register("durationMinutes", {
                min: { value: 1, message: "Min 1 minute" },
                max: { value: 1440, message: "Max 1440 minutes (24h)" },
                pattern: {
                  value: /^\d+$/,
                  message: "Must be a whole number",
                },
              })}
              type="number"
              min={1}
              placeholder="e.g. 90"
              className={`${inputCls} ${errors.durationMinutes ? "border-rose-500" : ""}`}
            />
            {errors.durationMinutes && (
              <p className="text-[11px] text-rose-500 mt-1">
                {errors.durationMinutes.message}
              </p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              <Tag size={11} />
              Tags (comma-separated)
            </label>
            <input
              {...register("tagsRaw")}
              placeholder="puja, havan, katha"
              className={inputCls}
            />
            <p className="text-[10px] text-gray-400 mt-1">
              e.g. puja, havan, online
            </p>
          </div>
        </div>
      </form>
    </EnterpriseModal>
  );
};

export default OfferingFormModal;


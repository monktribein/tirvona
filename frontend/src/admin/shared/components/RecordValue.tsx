import React from "react";
import { ExternalLink, FileText } from "lucide-react";
import {
  URL_LIKE,
  formatScalar,
  humanizeKey,
  isEmptyValue,
} from "../utils/recordFormat";

const MAX_DEPTH = 3;
const IMAGE_ASSET = /\.(jpe?g|png|webp|gif|svg|avif|heic)($|\?)/i;
const PDF_ASSET = /\.pdf($|\?)/i;

const AssetValue: React.FC<{ url: string }> = ({ url }) => {
  if (IMAGE_ASSET.test(url))
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex flex-col gap-1 rounded-xl border border-gray-200 dark:border-slate-700 p-1.5 hover:border-[#0A4DA6]"
      >
        <img src={url} alt="Uploaded document" className="h-20 w-28 rounded-lg object-cover bg-slate-900" />
        <span className="inline-flex items-center justify-center gap-1 text-[10px] font-extrabold text-[#0A4DA6]">
          <ExternalLink size={10} /> Open image
        </span>
      </a>
    );

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1.5 text-[10px] font-extrabold text-[#0A4DA6] hover:bg-blue-100"
    >
      <FileText size={12} /> {PDF_ASSET.test(url) ? "Open PDF" : "Open document"}
      <ExternalLink size={10} />
    </a>
  );
};

export const RecordValue: React.FC<{ value: unknown; depth?: number }> = ({
  value,
  depth = 0,
}) => {
  if (isEmptyValue(value))
    return <span className="text-gray-400 dark:text-gray-500">—</span>;

  if (Array.isArray(value)) {
    if (!value.length)
      return <span className="text-gray-400 dark:text-gray-500">None</span>;
    if (value.every((item) => item === null || typeof item !== "object"))
      return (
        <span className="flex flex-wrap gap-1">
          {value.map((item, index) => (
            <span
              key={index}
              className="px-2 py-0.5 bg-gray-100 dark:bg-slate-800 rounded-full text-[10px] font-semibold"
            >
              <RecordValue value={item} depth={depth + 1} />
            </span>
          ))}
        </span>
      );
    if (depth >= MAX_DEPTH)
      return (
        <span className="text-gray-400 dark:text-gray-500">
          {value.length} items
        </span>
      );
    return (
      <ol className="space-y-1.5">
        {value.map((item, index) => (
          <li
            key={index}
            className="pl-2 border-l-2 border-gray-200 dark:border-slate-700"
          >
            <RecordValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ol>
    );
  }

  if (typeof value === "object" && !(value instanceof Date)) {
    const entries = Object.entries(value as Record<string, unknown>).filter(
      ([key, item]) => key !== "__v" && !isEmptyValue(item),
    );
    if (!entries.length)
      return <span className="text-gray-400 dark:text-gray-500">—</span>;
    if (depth >= MAX_DEPTH)
      return (
        <span className="text-gray-400 dark:text-gray-500">
          {entries.length} fields
        </span>
      );
    return (
      <dl className="space-y-0.5">
        {entries.map(([key, item]) => (
          <div key={key} className="flex flex-wrap items-baseline gap-x-1.5">
            <dt className="text-gray-400 dark:text-gray-500">
              {humanizeKey(key)}
            </dt>
            <dd className="font-medium text-[#0B192C] dark:text-white break-all">
              <RecordValue value={item} depth={depth + 1} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  if (typeof value === "string" && URL_LIKE.test(value))
    return <AssetValue url={value} />;
  const text = formatScalar(value);
  return <span className="break-words">{text}</span>;
};

export const RecordFieldList: React.FC<{
  data: unknown;
  emptyLabel?: string;
  className?: string;
}> = ({ data, emptyLabel = "No data provided", className = "" }) => {
  if (isEmptyValue(data) || typeof data !== "object")
    return (
      <p className={`text-gray-400 dark:text-gray-500 ${className}`}>
        {isEmptyValue(data) ? emptyLabel : <RecordValue value={data} />}
      </p>
    );

  if (Array.isArray(data))
    return (
      <div className={className}>
        <RecordValue value={data} />
      </div>
    );

  const entries = Object.entries(data as Record<string, unknown>).filter(
    ([key, value]) => key !== "__v" && !isEmptyValue(value),
  );
  if (!entries.length)
    return (
      <p className={`text-gray-400 dark:text-gray-500 ${className}`}>
        {emptyLabel}
      </p>
    );

  return (
    <dl className={`space-y-1.5 ${className}`}>
      {entries.map(([key, value]) => (
        <div key={key} className="grid grid-cols-[minmax(0,7rem)_1fr] gap-x-3">
          <dt className="text-[10px] font-bold tracking-wider text-gray-400 dark:text-gray-500 pt-0.5">
            {humanizeKey(key)}
          </dt>
          <dd className="min-w-0">
            <RecordValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  );
};

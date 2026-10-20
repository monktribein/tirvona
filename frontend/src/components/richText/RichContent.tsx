import React, { useMemo } from "react";
import { sanitizeRichHtml } from "../../lib/richText";
import "./richText.css";

interface Props {
  html: string;
  className?: string;
}

/** Renders content written with RichTextEditor. The HTML is re-sanitised on every render. */
export const RichContent: React.FC<Props> = ({ html, className = "" }) => {
  const safe = useMemo(() => sanitizeRichHtml(html), [html]);
  return (
    <div
      className={`tv-rich ${className}`.trim()}
      // eslint-disable-next-line react/no-danger -- sanitised by the allow-list in lib/richText
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
};

export default RichContent;

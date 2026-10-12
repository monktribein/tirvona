/**
 * Live katha / puja on YouTube. The pandit streams on their own YouTube
 * channel; Tirvona shows the stream: embedded when the link is a specific
 * video / stream, otherwise as a button to the channel's live page.
 */
import React, { useState } from "react";
import { ExternalLink, Radio } from "lucide-react";
import { Button, Modal, cx } from "../ui";

export interface LiveStream {
  youtubeUrl: string;
  videoId?: string | null;
}

/** The video id of a YouTube link, when it points at one video / stream (mirrors the server's parser). */
export const youtubeVideoId = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const id =
      u.hostname === "youtu.be"
        ? parts[0]
        : parts[0] === "watch"
          ? u.searchParams.get("v")
          : ["live", "embed", "shorts"].includes(parts[0])
            ? parts[1]
            : null;
    return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

/** The player itself (privacy-enhanced embed), or a link out when there is no single video to embed. */
export const YouTubePlayer: React.FC<{ stream: LiveStream; title?: string }> = ({ stream, title = "Live katha / puja" }) => {
  const id = stream.videoId ?? youtubeVideoId(stream.youtubeUrl);
  return (
    <div className="space-y-3">
      {id ? (
        <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ) : (
        <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600 dark:bg-slate-900/60 dark:text-gray-400">
          Pandit ji streams on their YouTube channel. Open it to watch the live katha / puja.
        </p>
      )}
      <a
        href={stream.youtubeUrl}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-[#FF0000] px-5 text-sm font-bold text-white hover:bg-[#d90000] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F28C28] focus-visible:ring-offset-2"
      >
        <Radio size={16} aria-hidden="true" />
        Open on YouTube
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  );
};

/** "Watch live on YouTube" button + player dialog. Renders nothing when there is no link. */
export const WatchLiveButton: React.FC<{ stream?: LiveStream | null; title?: string; className?: string; label?: string }> = ({
  stream,
  title,
  className,
  label = "Watch live on YouTube",
}) => {
  const [open, setOpen] = useState(false);
  if (!stream?.youtubeUrl) return null;
  return (
    <>
      <Button className={cx("!bg-[#FF0000] !text-white hover:!bg-[#d90000]", className)} onClick={() => setOpen(true)}>
        <Radio size={14} aria-hidden="true" />
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={title ? `${title}: live` : "Live katha / puja"}
        description="Streaming on YouTube"
        footer={
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {open && <YouTubePlayer stream={stream} title={title} />}
      </Modal>
    </>
  );
};

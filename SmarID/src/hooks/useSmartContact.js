import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProfile,
  logEvent,
  slugFromLocation,
  sourceFromLocation,
} from "../services/smartContactApi";

export const useSmartContact = () => {
  const [state, setState] = useState({
    status: "loading",
    profile: null,
    error: "",
  });

  const slug = slugFromLocation();
  const source = sourceFromLocation();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    if (!slug) {
      setState({ status: "no-slug", profile: null, error: "" });
      return;
    }

    const isScan = !document.referrer;

    fetchProfile(slug, { source, scan: isScan })
      .then((profile) => setState({ status: "ready", profile, error: "" }))
      .catch((error) =>
        setState({
          status: error.notFound ? "missing" : "error",
          profile: null,
          error: error.message,
        }),
      );
  }, [slug, source]);

  const track = useCallback(
    (eventType) => logEvent(slug, eventType, source),
    [slug, source],
  );

  return { ...state, slug, source, track };
};

export const useDocumentMeta = (profile) => {
  useEffect(() => {
    if (!profile) return;
    const parts = [profile.displayName, profile.designation].filter(Boolean);
    document.title = `${parts.join(" – ")} | ${profile.organization || "Tirvona"}™`;

    const description = [profile.designation, profile.roleLine]
      .filter(Boolean)
      .join(" – ");
    let tag = document.querySelector('meta[name="description"]');
    if (!tag) {
      tag = document.createElement("meta");
      tag.setAttribute("name", "description");
      document.head.appendChild(tag);
    }
    tag.setAttribute("content", description || "Tirvona™ Smart Contact");
  }, [profile]);
};

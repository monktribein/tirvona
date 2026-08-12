import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchProfile,
  logEvent,
  slugFromLocation,
  sourceFromLocation,
} from "../services/smartContactApi";

/**
 * Loads the profile for the slug in the URL and exposes an event reporter.
 *
 * A visit is treated as a scan when there is no referrer: a camera app opens
 * the URL directly, whereas a shared link almost always carries one. It is a
 * heuristic and it is only ever used to label an analytics event, never to
 * decide anything the visitor sees.
 */
export const useSmartContact = () => {
  const [state, setState] = useState({
    status: "loading",
    profile: null,
    error: "",
  });

  const slug = slugFromLocation();
  const source = sourceFromLocation();
  // A ref, so re-renders never re-fire the load and double-count the view.
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;

    // A bare `/c/` is a different situation from a slug that does not resolve:
    // the first is an incomplete link, the second is a card for someone who is
    // not in the system. Telling a visitor "contact not found" when they never
    // named a contact is just confusing, so they get their own state.
    if (!slug) {
      setState({ status: "no-slug", profile: null, error: "" });
      return;
    }

    const isScan = !document.referrer;

    // No cancellation flag here, deliberately.
    //
    // The `loaded` ref already guarantees exactly one request for the life of
    // the component. Adding the usual `let cancelled = false` + cleanup on top
    // of it deadlocks under StrictMode: the first pass starts the request, the
    // simulated unmount sets cancelled = true, the second pass returns early at
    // the ref guard — and the in-flight response is then discarded by a flag
    // no later pass will ever reset. The page sat on its skeleton forever,
    // including when the request had failed. React 18+ no longer warns about
    // setting state after unmount, so there is nothing left for the flag to buy.
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

/**
 * Keeps the document title and description in step with the loaded profile.
 *
 * Purely for the browser tab and the in-app share sheet — a social crawler
 * never runs this, which is the limitation documented in index.html.
 */
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

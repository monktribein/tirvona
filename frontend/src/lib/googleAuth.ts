// Google Identity Services (GIS) loader + sign-in trigger.
//
// The GIS script is loaded on demand rather than in index.html, so pages that
// never show a Google button pay nothing for it.

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

/** Feature flag for the UI: no client ID means the buttons stay disabled. */
export const isGoogleConfigured = () => Boolean(GOOGLE_CLIENT_ID);

const GIS_SRC = "https://accounts.google.com/gsi/client";

let loaderPromise: Promise<void> | null = null;

const loadGis = (): Promise<void> => {
  if (typeof window === "undefined")
    return Promise.reject(new Error("No window"));
  if ((window as any).google?.accounts?.id) return Promise.resolve();
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Sign-In")),
      );
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loaderPromise = null; // allow a retry on the next click
      reject(new Error("Failed to load Google Sign-In"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
};

/**
 * Open Google's account chooser and resolve with the ID token (`credential`).
 *
 * GIS renders its own trusted popup — the page never sees the user's Google
 * password, and the credential it returns is a signed JWT the backend verifies
 * independently. Uses a hidden container so the existing buttons keep their
 * own styling instead of Google's.
 */
export const signInWithGoogle = (): Promise<string> =>
  new Promise((resolve, reject) => {
    if (!GOOGLE_CLIENT_ID) {
      reject(new Error("Google Sign-In is not configured."));
      return;
    }

    loadGis()
      .then(() => {
        const google = (window as any).google;
        let settled = false;

        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response: { credential?: string }) => {
            if (settled) return;
            settled = true;
            if (response?.credential) resolve(response.credential);
            else reject(new Error("Google sign-in was cancelled."));
          },
          cancel_on_tap_outside: true,
          auto_select: false,
          use_fedcm_for_prompt: true,
        });

        // A hidden host for the real Google button. Programmatically clicking it
        // opens the account chooser reliably across browsers, including where
        // third-party-cookie restrictions make `prompt()` a no-op.
        let host = document.getElementById("tv-google-host");
        if (!host) {
          host = document.createElement("div");
          host.id = "tv-google-host";
          host.style.cssText =
            "position:fixed;opacity:0;pointer-events:none;width:0;height:0;overflow:hidden;";
          document.body.appendChild(host);
        }
        host.innerHTML = "";
        google.accounts.id.renderButton(host, {
          type: "standard",
          size: "large",
        });

        const realButton = host.querySelector<HTMLElement>(
          'div[role="button"], button',
        );
        if (realButton) {
          realButton.click();
        } else {
          google.accounts.id.prompt();
        }

        // Nothing arrived — the user closed the chooser. Clear the pending
        // promise so a later click starts fresh instead of hanging forever.
        setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Google sign-in was cancelled."));
          }
        }, 120000);
      })
      .catch(reject);
  });

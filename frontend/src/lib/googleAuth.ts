
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

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

        setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error("Google sign-in was cancelled."));
          }
        }, 120000);
      })
      .catch(reject);
  });

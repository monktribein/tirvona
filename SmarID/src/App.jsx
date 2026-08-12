import React from "react";
import { ContactActions } from "./components/ContactActions";
import { InactiveNotice } from "./components/InactiveNotice";
import { ProfileHeader } from "./components/ProfileHeader";
import { TirvonaMark } from "./components/TirvonaMark";
import { useDocumentMeta, useSmartContact } from "./hooks/useSmartContact";

/**
 * The Tirvona Smart Contact page (spec §4–§8).
 *
 * There is no router. One URL shape, one view — pulling in react-router would
 * add a dependency and a bundle for a slug this app reads straight off
 * `location.pathname`, against a two-second budget on mobile data (spec §39).
 */
const Footer = () => (
  <footer className="footer">
    <TirvonaMark />
    <p className="footer-line">
      Connecting Sacred Destinations. Empowering Communities.
    </p>
    <a
      className="footer-link"
      href="https://www.tirvona.com"
      target="_blank"
      rel="noopener noreferrer"
    >
      www.tirvona.com
    </a>
  </footer>
);

/**
 * `page-main` takes the leftover height and centres its child, so a short
 * notice card sits in the middle of the viewport instead of clinging to the
 * top with a screen of dead space beneath it. A full profile card is taller
 * than the space available, at which point the wrapper simply grows and the
 * page scrolls as normal.
 */
const Shell = ({ children }) => (
  <div className="page">
    <div className="page-main">{children}</div>
    <Footer />
  </div>
);

const App = () => {
  const { status, profile, error, slug, source, track } = useSmartContact();
  useDocumentMeta(profile);

  if (status === "loading") {
    return (
      <Shell>
        {/*
          A skeleton in the final layout's shape, not a spinner: the page
          reflows less when the data lands, and someone on a slow connection
          sees the card taking form rather than an indefinite wait.
        */}
        <main className="card" aria-busy="true" aria-live="polite">
          <div className="skeleton skeleton-avatar" />
          <div className="skeleton skeleton-line skeleton-lg" />
          <div className="skeleton skeleton-line skeleton-md" />
          <div className="skeleton skeleton-btn" />
          <span className="visually-hidden">Loading contact details…</span>
        </main>
      </Shell>
    );
  }

  // A bare /c/ with no slug — an incomplete link, not a missing person.
  if (status === "no-slug") {
    return (
      <Shell>
        <main className="card card-notice">
          <div className="brand">
            <TirvonaMark />
            <p className="brand-tagline">
              India&rsquo;s Digital Infrastructure for Religious Destinations
            </p>
          </div>
          <div className="notice-icon" aria-hidden="true">
            ⌁
          </div>
          <h1 className="profile-name notice-name">Incomplete link</h1>
          <p className="notice-message">
            This link is missing the representative&rsquo;s profile name.
          </p>
          <p className="notice-help">
            Scan the QR code again, or check the address ends with a name — for
            example <code>/c/ravindr-bhardwaj</code>.
          </p>
          <a className="btn btn-primary" href="https://www.tirvona.com">
            Visit tirvona.com
          </a>
        </main>
      </Shell>
    );
  }

  if (status === "missing") {
    return (
      <Shell>
        <main className="card card-notice">
          <div className="brand">
            <TirvonaMark />
            <p className="brand-tagline">
              India&rsquo;s Digital Infrastructure for Religious Destinations
            </p>
          </div>
          <div className="notice-icon" aria-hidden="true">
            ?
          </div>
          <h1 className="profile-name notice-name">Contact not found</h1>
          <p className="notice-message">
            {error || "This Tirvona contact page could not be found."}
          </p>
          <p className="notice-help">
            For assistance, please contact the Tirvona central office.
          </p>
          <a className="btn btn-primary" href="mailto:partners@tirvona.com">
            Contact Tirvona
          </a>
          <a
            className="btn btn-ghost"
            href="https://www.tirvona.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Visit tirvona.com
          </a>
        </main>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <main className="card card-notice">
          <div className="notice-icon" aria-hidden="true">
            !
          </div>
          <h1 className="profile-name notice-name">Something went wrong</h1>
          <p className="notice-message">{error}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </main>
      </Shell>
    );
  }

  // Spec §22 — a profile that is no longer active never renders contact data.
  if (!profile.isActive) {
    return (
      <Shell>
        <InactiveNotice profile={profile} />
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="card">
        <ProfileHeader profile={profile} />
        <ContactActions
          profile={profile}
          slug={slug}
          source={source}
          onTrack={track}
        />
      </main>
    </Shell>
  );
};

export default App;

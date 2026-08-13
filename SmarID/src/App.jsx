import React from "react";
import { ContactActions } from "./components/ContactActions";
import { InactiveNotice } from "./components/InactiveNotice";
import { CardHeader, ProfileIdentity } from "./components/ProfileHeader";
import { useDocumentMeta, useSmartContact } from "./hooks/useSmartContact";

/**
 * The Tirvona Smart Contact page (spec §4–§8), laid out as an identity card.
 *
 * There is no router. One URL shape, one view — pulling in react-router would
 * add a dependency and a bundle for a slug this app reads straight off
 * `location.pathname`, against a two-second budget on mobile data (spec §39).
 */
const Footer = () => (
  <footer className="footer">
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

const Shell = ({ children }) => (
  <div className="page">
    <div className="page-main">{children}</div>
    <Footer />
  </div>
);

/** Notice states reuse the card chrome so they still read as a Tirvona badge. */
const NoticeCard = ({ icon, title, children }) => (
  <main className="card card-notice">
    <CardHeader />
    <div className="card-body">
      <div className="notice-icon" aria-hidden="true">
        {icon}
      </div>
      <h1 className="profile-name notice-name">{title}</h1>
      {children}
    </div>
    <div className="card-strip">Tirvona™ Smart Contact</div>
  </main>
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
          <CardHeader />
          <div className="card-body">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton skeleton-line skeleton-lg" />
            <div className="skeleton skeleton-line skeleton-md" />
            <div className="skeleton skeleton-btn" />
            <span className="visually-hidden">Loading contact details…</span>
          </div>
        </main>
      </Shell>
    );
  }

  // A bare URL with no slug — an incomplete link, not a missing person.
  if (status === "no-slug") {
    return (
      <Shell>
        <NoticeCard icon="⌁" title="Incomplete link">
          <p className="notice-message">
            This link is missing the representative&rsquo;s profile name.
          </p>
          <p className="notice-help">
            Scan the QR code again, or check the address ends with a name — for
            example <code>tirvona.com/ravindr-bhardwaj</code>.
          </p>
          <a className="btn btn-primary" href="https://www.tirvona.com">
            Visit tirvona.com
          </a>
        </NoticeCard>
      </Shell>
    );
  }

  if (status === "missing") {
    return (
      <Shell>
        <NoticeCard icon="?" title="Contact not found">
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
        </NoticeCard>
      </Shell>
    );
  }

  if (status === "error") {
    return (
      <Shell>
        <NoticeCard icon="!" title="Something went wrong">
          <p className="notice-message">{error}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </NoticeCard>
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
        <CardHeader />
        <div className="card-body">
          <ProfileIdentity profile={profile} />
          <ContactActions
            profile={profile}
            slug={slug}
            source={source}
            onTrack={track}
          />
        </div>
        <div className="card-strip">Tirvona™ Smart Contact</div>
      </main>
    </Shell>
  );
};

export default App;

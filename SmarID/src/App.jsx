import React from "react";
import { ContactActions } from "./components/ContactActions";
import { InactiveNotice } from "./components/InactiveNotice";
import { CardHeader, ProfileIdentity } from "./components/ProfileHeader";
import { useDocumentMeta, useSmartContact } from "./hooks/useSmartContact";

const Shell = ({ children }) => (
  <div className="page">
    <div className="page-main">{children}</div>
  </div>
);

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
    <div className="card-strip"><strong>♢ Tirvona™ Smart Contact</strong><span>Verified&nbsp; • &nbsp;Secure&nbsp; • &nbsp;Trusted</span></div>
  </main>
);

const App = () => {
  const { status, profile, error, slug, source, track } = useSmartContact();
  useDocumentMeta(profile);

  if (status === "loading") {
    return (
      <Shell>
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

  if (status === "no-slug") {
    return (
      <Shell>
        <NoticeCard icon="↗" title="Incomplete link">
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
        <div className="card-strip"><strong>♢ Tirvona™ Smart Contact</strong><span>Verified&nbsp; • &nbsp;Secure&nbsp; • &nbsp;Trusted</span></div>
      </main>
    </Shell>
  );
};

export default App;

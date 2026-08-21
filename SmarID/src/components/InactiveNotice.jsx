import React from "react";
import { CardHeader } from "./ProfileHeader";

export const InactiveNotice = ({ profile }) => (
  <main className="card card-notice">
    <CardHeader />

    <div className="card-body">
      <div className="notice-icon" aria-hidden="true">
        ⓘ
      </div>

      {profile?.displayName && (
        <h1 className="profile-name notice-name">{profile.displayName}</h1>
      )}

      <p className="notice-message">
        {profile?.inactiveNotice?.message ??
          "This Tirvona representative profile is no longer active."}
      </p>

      <p className="notice-help">
        For assistance, please contact the Tirvona central office.
      </p>

      <a
        className="btn btn-primary"
        href={`mailto:${profile?.inactiveNotice?.contactEmail ?? "partners@tirvona.com"}`}
      >
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
    </div>

    <div className="card-strip"><strong>♢ Tirvona™ Smart Contact</strong><span>Verified&nbsp; • &nbsp;Secure&nbsp; • &nbsp;Trusted</span></div>
  </main>
);

import React from "react";
import { TirvonaMark } from "./TirvonaMark";

/**
 * What an obsolete visiting card shows (spec §22).
 *
 * The representative's name stays visible so the visitor knows whose card they
 * are holding, but no contact detail appears — the server already withheld
 * them, and this component has nothing to leak. The point is that an old card
 * degrades into something honest rather than into a dead link or, worse, a
 * number that now belongs to someone else.
 */
export const InactiveNotice = ({ profile }) => (
  <main className="card card-notice">
    <div className="brand">
      <TirvonaMark />
      <p className="brand-tagline">
        India&rsquo;s Digital Infrastructure for Religious Destinations
      </p>
    </div>

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
  </main>
);

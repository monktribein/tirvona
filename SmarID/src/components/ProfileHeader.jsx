import React from "react";
import { TirvonaMark } from "./TirvonaMark";

/** Initials, for when a profile has no photograph yet. */
const initials = (name) =>
  String(name ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("") || "T";

/**
 * Logo band, photograph and identity block (spec §6).
 *
 * The photo is `loading="eager"` and `fetchpriority="high"` — it is the
 * largest contentful paint on this page, and the two-second budget in spec §39
 * is mostly a question of how quickly it arrives.
 */
export const ProfileHeader = ({ profile }) => {
  const { displayName, designation, roleLine, organization, photoUrl } = profile;

  return (
    <header className="profile-header">
      <div className="brand">
        <TirvonaMark />
        <p className="brand-tagline">
          India&rsquo;s Digital Infrastructure for Religious Destinations
        </p>
      </div>

      <div className="avatar-wrap">
        {photoUrl ? (
          <img
            className="avatar"
            src={photoUrl}
            alt={displayName}
            width="128"
            height="128"
            loading="eager"
            fetchPriority="high"
            decoding="async"
          />
        ) : (
          <div className="avatar avatar-fallback" aria-hidden="true">
            {initials(displayName)}
          </div>
        )}
      </div>

      <h1 className="profile-name">{displayName}</h1>
      {designation && <p className="profile-designation">{designation}</p>}
      {roleLine && <p className="profile-role">{roleLine}</p>}
      {organization && (
        <p className="profile-org">
          {organization}
          <sup>&trade;</sup>
        </p>
      )}
    </header>
  );
};

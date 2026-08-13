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

/** The navy band at the top of the card, shared by the profile and notices. */
export const CardHeader = () => (
  <header className="card-header">
    <span className="brand-chip">
      <TirvonaMark height={30} />
    </span>
    <p className="card-header-tag">Authorised Representative</p>
  </header>
);

/**
 * Photograph and identity block (spec §6).
 *
 * The photo overlaps the navy band by design — it is what makes the layout
 * read as an identity card rather than a web page, and it is the largest
 * contentful paint, so it loads eagerly at high priority against the
 * two-second budget in spec §39.
 */
export const ProfileIdentity = ({ profile }) => {
  const { displayName, designation, roleLine, organization, photoUrl, employeeId } =
    profile;

  return (
    <>
      <div className="avatar-wrap">
        {photoUrl ? (
          <img
            className="avatar"
            src={photoUrl}
            alt={displayName}
            width="108"
            height="108"
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
        <span className="profile-org">
          {organization}
          <sup>&trade;</sup>
        </span>
      )}
      {employeeId && <p className="profile-id">ID · {employeeId}</p>}
    </>
  );
};

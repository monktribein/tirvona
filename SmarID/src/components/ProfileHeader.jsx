import React from "react";
import { TirvonaMark } from "./TirvonaMark";

const initials = (name) => String(name ?? "").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "T";

export const CardHeader = () => (
  <header className="card-header">
    <span className="card-eyebrow">Tirvona Digital Identity</span>
    <span className="brand-chip"><TirvonaMark height={58} /></span>
    <p className="card-header-tag"><span /> Authorised Representative <span /></p>
  </header>
);

export const ProfileIdentity = ({ profile }) => {
  const { displayName, designation, roleLine, organization, photoUrl, employeeId } = profile;
  return (
    <section className="identity" aria-label="Representative identity">
      <div className="avatar-wrap">
        {photoUrl ? <img className="avatar" src={photoUrl} alt={displayName} width="116" height="116" loading="eager" fetchPriority="high" decoding="async" /> : <div className="avatar avatar-fallback" aria-hidden="true">{initials(displayName)}</div>}
        <span className="verified-dot" title="Tirvona verified">✓</span>
      </div>
      <h1 className="profile-name">{displayName}</h1>
      {designation && <p className="profile-designation">{designation}</p>}
      {roleLine && <p className="profile-role">{roleLine}</p>}
      {organization && <span className="profile-org">{organization}<sup>™</sup></span>}
      {employeeId && <p className="profile-id">ID · {employeeId}</p>}
    </section>
  );
};

import React, { useState } from "react";
import { idCardUrl, vcardUrl } from "../services/smartContactApi";
import { Icon } from "./Icon";

const waNumber = (phone) => String(phone ?? "").replace(/[^\d]/g, "");

export const ContactActions = ({ profile, slug, source, onTrack }) => {
  const {
    primaryPhone,
    secondaryPhone,
    whatsappPhone,
    email,
    website,
    officeAddress,
  } = profile;
  const whatsapp = waNumber(whatsappPhone || primaryPhone);
  const directionsUrl = officeAddress
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`
    : "";
  const [shareLabel, setShareLabel] = useState("Share Profile");

  const quickActions = [
    primaryPhone && {
      label: "Call",
      icon: "phone",
      href: `tel:${primaryPhone}`,
      event: "CALL_CLICK",
    },
    whatsapp && {
      label: "WhatsApp",
      icon: "chat",
      href: `https://wa.me/${whatsapp}`,
      event: "WHATSAPP_CLICK",
      external: true,
    },
    email && {
      label: "Email",
      icon: "mail",
      href: `mailto:${email}`,
      event: "EMAIL_CLICK",
    },
    directionsUrl && {
      label: "Directions",
      icon: "pin",
      href: directionsUrl,
      event: "DIRECTIONS_CLICK",
      external: true,
    },
    !directionsUrl && website && {
      label: "Website",
      icon: "globe",
      href: website,
      event: "WEBSITE_CLICK",
      external: true,
    },
  ].filter(Boolean);

  const shareProfile = async () => {
    const shareData = {
      title: `${profile.displayName} — Tirvona Smart Contact`,
      text: `View ${profile.displayName}'s verified Tirvona contact profile.`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        setShareLabel("Link Copied");
        window.setTimeout(() => setShareLabel("Share Profile"), 1800);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        setShareLabel("Unable to Share");
        window.setTimeout(() => setShareLabel("Share Profile"), 1800);
      }
    }
  };

  return (
    <div className="actions">
      <a
        className="btn btn-primary save-contact"
        href={vcardUrl(slug, source)}
        onClick={() => onTrack("SAVE_CONTACT")}
      >
        <Icon name="download" size={23} />
        <span>Save to Contacts</span>
        <span className="save-divider" />
        <Icon name="qr" size={22} />
      </a>

      <div className="actions-grid">
        {quickActions.map((action) => (
          <a
            key={action.label}
            className="btn btn-secondary"
            href={action.href}
            target={action.external ? "_blank" : undefined}
            rel={action.external ? "noopener noreferrer" : undefined}
            onClick={() => onTrack(action.event)}
          >
            <span className={`btn-icon icon-${action.icon}`}>
              <Icon name={action.icon} />
            </span>
            <span>{action.label}</span>
          </a>
        ))}
      </div>

      <div className="utility-actions">
        <a className="btn btn-ghost" href={idCardUrl(slug, source)}>
          <Icon name="card" size={19} />
          <span>Download ID Card</span>
          <span className="btn-note">PDF</span>
        </a>
        <button type="button" className="btn btn-ghost btn-share" onClick={shareProfile}>
          <Icon name="share" size={19} />
          <span>{shareLabel}</span>
        </button>
      </div>

      <section className="details-wrap" aria-label="Contact details">
        <p className="section-label">Contact information</p>
        <dl className="details">
          {primaryPhone && (
            <div className="detail-row">
              <dt><Icon name="phone" size={17} />Mobile</dt>
              <dd><a href={`tel:${primaryPhone}`}>{primaryPhone}</a></dd>
            </div>
          )}
          {secondaryPhone && (
            <div className="detail-row">
              <dt><Icon name="building" size={17} />Office</dt>
              <dd><a href={`tel:${secondaryPhone}`}>{secondaryPhone}</a></dd>
            </div>
          )}
          {email && (
            <div className="detail-row">
              <dt><Icon name="mail" size={17} />Email</dt>
              <dd><a href={`mailto:${email}`}>{email}</a></dd>
            </div>
          )}
          {website && (
            <div className="detail-row">
              <dt><Icon name="globe" size={17} />Website</dt>
              <dd><a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//, "")}</a></dd>
            </div>
          )}
          {officeAddress && (
            <div className="detail-row detail-address">
              <dt><Icon name="pin" size={17} />Office address</dt>
              <dd>{officeAddress}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
};

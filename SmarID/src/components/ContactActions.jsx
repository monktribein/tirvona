import React from "react";
import { vcardUrl } from "../services/smartContactApi";

/**
 * Digits only, for `wa.me` (spec §42). The link rejects a leading `+`.
 */
const waNumber = (phone) => String(phone ?? "").replace(/[^\d]/g, "");

/**
 * The primary Save Contact button and the four secondary actions (spec §6).
 *
 * Every action is a real anchor with a real `href`, not a button with a click
 * handler. That is what lets a long-press offer "copy number", what keeps the
 * page working if the analytics call fails, and what makes the whole thing
 * behave correctly when the OS opens the link in another app. The tracking
 * call rides along on click and is never awaited — spec §3 wants the .vcf
 * handoff to feel immediate.
 */
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

  return (
    <div className="actions">
      {/*
        A plain download link rather than a fetch-and-blob dance. Handing the
        browser a URL with `Content-Disposition: attachment` is what triggers
        the OS contact importer on both platforms; constructing the file in JS
        would break the iOS path, where Safari needs a real navigation to hand
        the .vcf to Contacts.
      */}
      <a
        className="btn btn-primary"
        href={vcardUrl(slug, source)}
        onClick={() => onTrack("SAVE_CONTACT")}
      >
        <span aria-hidden="true">⬇</span> Save Contact
      </a>

      <div className="actions-grid">
        {primaryPhone && (
          <a
            className="btn btn-secondary"
            href={`tel:${primaryPhone}`}
            onClick={() => onTrack("CALL_CLICK")}
          >
            <span aria-hidden="true">📞</span>
            Call
          </a>
        )}

        {whatsapp && (
          <a
            className="btn btn-secondary"
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTrack("WHATSAPP_CLICK")}
          >
            <span aria-hidden="true">💬</span>
            WhatsApp
          </a>
        )}

        {email && (
          <a
            className="btn btn-secondary"
            href={`mailto:${email}`}
            onClick={() => onTrack("EMAIL_CLICK")}
          >
            <span aria-hidden="true">✉</span>
            Email
          </a>
        )}

        {website && (
          <a
            className="btn btn-secondary"
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onTrack("WEBSITE_CLICK")}
          >
            <span aria-hidden="true">🌐</span>
            Website
          </a>
        )}
      </div>

      {/* Optional per spec §6 — shown only when there is an address to open. */}
      {officeAddress && (
        <a
          className="btn btn-ghost"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onTrack("DIRECTIONS_CLICK")}
        >
          <span aria-hidden="true">📍</span> Directions
        </a>
      )}

      <dl className="details">
        {primaryPhone && (
          <div className="detail-row">
            <dt>Mobile</dt>
            <dd>
              <a href={`tel:${primaryPhone}`}>{primaryPhone}</a>
            </dd>
          </div>
        )}
        {secondaryPhone && (
          <div className="detail-row">
            <dt>Office</dt>
            <dd>
              <a href={`tel:${secondaryPhone}`}>{secondaryPhone}</a>
            </dd>
          </div>
        )}
        {email && (
          <div className="detail-row">
            <dt>Email</dt>
            <dd>
              <a href={`mailto:${email}`}>{email}</a>
            </dd>
          </div>
        )}
        {website && (
          <div className="detail-row">
            <dt>Website</dt>
            <dd>
              <a href={website} target="_blank" rel="noopener noreferrer">
                {website.replace(/^https?:\/\//, "")}
              </a>
            </dd>
          </div>
        )}
        {officeAddress && (
          <div className="detail-row">
            <dt>Office</dt>
            <dd>{officeAddress}</dd>
          </div>
        )}
      </dl>
    </div>
  );
};

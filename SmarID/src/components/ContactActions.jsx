import React from "react";
import { idCardUrl, vcardUrl } from "../services/smartContactApi";
import { Icon } from "./Icon";

const waNumber = (phone) => String(phone ?? "").replace(/[^\d]/g, "");

export const ContactActions = ({ profile, slug, source, onTrack }) => {
  const { primaryPhone, secondaryPhone, whatsappPhone, email, website, officeAddress } = profile;
  const whatsapp = waNumber(whatsappPhone || primaryPhone);
  const quickActions = [
    primaryPhone && { label: "Call", icon: "phone", href: `tel:${primaryPhone}`, event: "CALL_CLICK" },
    whatsapp && { label: "WhatsApp", icon: "chat", href: `https://wa.me/${whatsapp}`, event: "WHATSAPP_CLICK", external: true },
    email && { label: "Email", icon: "mail", href: `mailto:${email}`, event: "EMAIL_CLICK" },
    website && { label: "Website", icon: "globe", href: website, event: "WEBSITE_CLICK", external: true },
  ].filter(Boolean);

  return (
    <div className="actions">
      <a className="btn btn-primary" href={vcardUrl(slug, source)} onClick={() => onTrack("SAVE_CONTACT")}><Icon name="download" size={19} /><span>Save to Contacts</span></a>
      <div className="actions-grid">
        {quickActions.map((action) => <a key={action.label} className="btn btn-secondary" href={action.href} target={action.external ? "_blank" : undefined} rel={action.external ? "noopener noreferrer" : undefined} onClick={() => onTrack(action.event)}><span className="btn-icon"><Icon name={action.icon} /></span><span>{action.label}</span></a>)}
      </div>
      <div className="utility-actions">
        <a className="btn btn-ghost" href={idCardUrl(slug, source)}><Icon name="card" size={18} /><span>Download ID Card</span><span className="btn-note">PDF</span></a>
        {officeAddress && <a className="btn btn-ghost" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(officeAddress)}`} target="_blank" rel="noopener noreferrer" onClick={() => onTrack("DIRECTIONS_CLICK")}><Icon name="pin" size={18} /><span>Directions</span></a>}
      </div>
      <section className="details-wrap" aria-label="Contact details">
        <p className="section-label">Contact information</p>
        <dl className="details">
          {primaryPhone && <div className="detail-row"><dt>Mobile</dt><dd><a href={`tel:${primaryPhone}`}>{primaryPhone}</a></dd></div>}
          {secondaryPhone && <div className="detail-row"><dt>Office</dt><dd><a href={`tel:${secondaryPhone}`}>{secondaryPhone}</a></dd></div>}
          {email && <div className="detail-row"><dt>Email</dt><dd><a href={`mailto:${email}`}>{email}</a></dd></div>}
          {website && <div className="detail-row"><dt>Website</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//, "")}</a></dd></div>}
          {officeAddress && <div className="detail-row detail-address"><dt>Office address</dt><dd>{officeAddress}</dd></div>}
        </dl>
      </section>
    </div>
  );
};

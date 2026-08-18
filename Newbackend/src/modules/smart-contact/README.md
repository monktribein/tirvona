# Smart Contact QR — backend module

The Tirvona-branded implementation of what the specification (§43) calls the
**NEP Smart Identity & Contact Engine**. One QR, one permanent URL, an editable
profile behind it.

## The invariant everything else serves

A printed QR encodes **only** `https://www.tirvona.com/c/{slug}` — never a
phone number, an email or a designation. Cards outlive the details on them, so:

- `QrService` receives a URL and nothing else. It is structurally incapable of
  encoding contact data.
- `destinationUrl` on a QR row is `immutable`, so "Regenerate QR Artwork"
  provably cannot change where a card points.
- `slug` changes are rejected unless the caller passes `allowSlugChange`, and
  produce a `SLUG_CHANGED` audit line when they do.
- There is **no delete endpoint**. A profile whose cards are circulating can
  only be archived, so the URL keeps resolving to the "no longer active"
  notice rather than 404-ing (spec §22).

## Isolation

| Concern | How it is isolated |
| --- | --- |
| Data | Own Mongoose connection (`SMART_CONTACT_CONNECTION`) and own database. Models registered against it cannot be resolved from platform modules, and vice versa. |
| Config | `SMART_CONTACT_*` read straight from `process.env`, not from `environment()`. |
| Audit | Local `smart_contact_audit_logs`, not the platform audit module — an extracted service carries its own history. |
| Analytics | Local `smart_contact_events`. |
| Identity | No accounts of its own. Admins are platform staff; the public surface has no identity at all. |
| Exports | The module exports nothing and imports no other feature module. |

Profile photographs arrive as **URLs** already produced by the platform's
existing upload endpoint, so this module never touches file bytes and stays off
the upload/scanning path entirely.

### Extraction checklist

Move the folder, point `SMART_CONTACT_MONGODB_URI` at its own cluster, and swap
the `@Roles` / `@CurrentUser` imports for the new host's equivalents. Nothing
else in the platform references it.

## Layout

```
domain/          constants, enums, view types (no storage concepts)
config/          SMART_CONTACT_* settings + URL builders
infrastructure/  named Mongoose connection + the four schemas
application/     profiles, qr-codes, qr rendering, vcard, analytics, audit
presentation/    public + admin controllers, DTOs
```

## API

Global prefix is `api`; these controllers are URI-versioned at `v1`.

### Public — `@Public()`, rate limited, no session

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/api/v1/smart-contact/{slug}` | Records `PROFILE_VIEW` server-side. `?scan=true` also records `QR_SCAN`; `?src=` attributes the placement. |
| GET | `/api/v1/smart-contact/{slug}/vcard` | vCard 3.0, generated per request. **410** when the profile is not active. |
| POST | `/api/v1/smart-contact/{slug}/event` | CTA taps only. 204. |

### Admin — `@Roles(...)`, platform bearer token

| Method | Path |
| --- | --- |
| GET | `/api/v1/admin/smart-contacts` (+ `/stats`) |
| POST | `/api/v1/admin/smart-contacts` |
| GET / PUT | `/api/v1/admin/smart-contacts/{id}` |
| POST | `/{id}/activate` · `/{id}/disable` · `/{id}/archive` |
| GET / POST | `/{id}/qr` |
| POST | `/{id}/qr/{qrId}/retire` |
| GET | `/{id}/qr/{qrId}/download/{format}` · `/{id}/qr-preview/{format}` |
| GET | `/{id}/analytics` · `/{id}/audit` · `/{id}/vcard-preview` |

`format` is `svg` \| `png` \| `pdf` as its own path segment, not a filename
extension — Express 5's router treats a dot as a literal and `:qrId.:format`
parses inconsistently across versions. The saved filename comes from
`Content-Disposition`.

## Analytics privacy

The request IP is used to derive a salted, daily-rotating `sessionHash` and
(from CDN headers only) an approximate country/state/city — then discarded. No
IP is stored on an event, no third-party geo lookup is made, and no GPS
permission is requested (spec §26, §38).

`PROFILE_VIEW`, `QR_SCAN` and `VCARD_DOWNLOAD` are recorded server-side and are
**not** accepted from clients: they are the denominators of the conversion
rate, and accepting them would make that number forgeable.

## Two artwork layouts

The render endpoints take `?layout=`:

| Layout | What it is | Formats |
| --- | --- | --- |
| `qr` (default) | The bare symbol, for dropping into a card design you already have. | SVG, PNG, PDF |
| `card` | A finished 88 × 55 mm visiting card — logo, name, designation, role line and contact lines laid out around the symbol. | SVG, PDF |

The card **does not** change the invariant. The QR on it still encodes only the
profile URL; the contact details are set as text beside it for a human to read.
So editing a number updates the contact page and every future vCard instantly,
while the number *printed on the card* is fixed until the next print run —
which is exactly the asymmetry the product exists to exploit.

## Known format limits

- **PNG** carries no logo or frame, and is not offered for `layout=card` at
  all — flattening that layout would mean shipping a server-side SVG
  rasteriser (a large native dependency) to produce something worse than the
  vector a printer wants. `ContactCardService.render()` returns a 400 for it
  rather than silently substituting a different layout.
- **PDF** is WinAnsi-encoded: standard Type 1 fonts, no embedded glyphs. The
  Hindi caption from spec §16 and any Devanagari name must come from SVG.
  `QrService.pdfCaptionIsRenderable()` and `ContactCardService.pdfSafe()` let a
  caller check before offering the format.
- **Photographs** appear on the SVG card only, for the same reason — embedding
  a raster image in the PDF would mean fetching and decoding it per request.

## Configuration

All optional; every value falls back to something that works on a fresh
checkout. See `config/smart-contact.config.ts`.

| Variable | Default |
| --- | --- |
| `SMART_CONTACT_MONGODB_URI` | falls back to `MONGODB_URI` |
| `SMART_CONTACT_MONGODB_DB_NAME` | `tirvona_smart_contact` |
| `SMART_CONTACT_PUBLIC_BASE_URL` | `https://www.tirvona.com` |
| `SMART_CONTACT_PUBLIC_PATH_PREFIX` | `c` |
| `SMART_CONTACT_API_BASE_URL` | `http://localhost:5000` |
| `SMART_CONTACT_QR_DARK_COLOR` / `_LIGHT_` / `_ACCENT_` | `#0B192C` / `#FFFFFF` / `#D4AF37` |
| `SMART_CONTACT_QR_LOGO_URL` | unset (no centre logo) |
| `SMART_CONTACT_INACTIVE_EMAIL` | `partners@tirvona.com` |
| `SMART_CONTACT_EVENT_RETENTION_DAYS` | `730` (`0` disables the TTL index) |
| `SMART_CONTACT_SESSION_SALT` | falls back to `JWT_SECRET` |

`SMART_CONTACT_PUBLIC_BASE_URL` is separate from `CLIENT_URL` on purpose — see
the invariant at the top.

## Tests

```bash
npm test -- --testPathPatterns=smart-contact
```

Covers vCard 3.0 output (CRLF, escaping, UTF-8 line folding), QR rendering in
all three formats including PDF cross-reference offsets, slug derivation, phone
normalisation, and the public projection's withholding of contact details on a
non-active profile.

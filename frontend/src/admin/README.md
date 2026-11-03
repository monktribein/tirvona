# Admin and staff dashboards (`frontend/src/admin/`)

Screens used inside the dashboard layout (Super Admin, HR / Executive, owners, managers and
other staff roles). Public storefront pages live in `../pages/` and `../modules/`.

## Folders

| Folder | Screens |
|---|---|
| `shared/` | `DashboardLayout` (sidebar + header for every role), the shared `Enterprise*` table/page components, `PasswordHelpPanel`, helpers |
| `dashboard/` | Super Admin overview dashboard |
| `users/` | User accounts, roles, password help |
| `ashrams/` | Stays: listings, verification queue, inspections |
| `approvals/` | Central approval centre |
| `temples/` | Temple list and the add/edit temple form |
| `aarti/` | Aarti approvals and control centre |
| `events/` | Event approvals and control centre |
| `pilgrimage/` | Pilgrimage circuits and itinerary planner |
| `parking/` | Parking administration |
| `food/` | Food vendors and kitchen wallets |
| `marketplace/` | Marketplace administration |
| `offers/` | Offers and deals |
| `content/` | Visitor articles |
| `reviews/` | Review moderation |
| `leads/` | Lead collection: leads, live tracking, field agents |
| `hr/` | HR: employees, offices, attendance, tasks, reports, HR & Executive accounts, area dashboard |
| `smart-contact/` | Smart Contact QR identity cards |
| `support/` | Support tickets |
| `notifications/` | Notification dispatch |
| `refunds/`, `payouts/`, `wallets/` | Refunds, RazorpayX payouts, wallets |
| `reports/` | Audit logs |
| `developer-api/` | Partner API keys and integration guide |

Pandit (provider) admin screens are kept with the rest of the pandit feature in
`../modules/pandit/admin/`.

## Conventions

- Pages live in `<folder>/pages/` (small folders keep the page file at the top level).
- Components used by one feature live in `<folder>/components/`; anything shared goes in `shared/`.
- Routes and role gates for every screen are declared in `../App.tsx`; sidebar links in
  `shared/layouts/DashboardLayout.tsx`.

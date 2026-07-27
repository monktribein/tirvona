# Frontend Admin Modular Architecture (`frontend/src/admin/`)

This directory contains the modular architecture for the Tirvona Admin Panel frontend.

## Folder Structure

Each feature module is isolated within its own folder:

- `shared/`: Reusable layouts (`DashboardLayout`), navigation sidebars, common tables, dialogs, charts, hooks, and helpers.
- `dashboard/`: Admin Console & Overview dashboard.
- `users/`: User accounts management and permissions control.
- `owners/`: Ashram trust owners and partner portal integrations.
- `ashrams/`: Ashram listings, verification queue, and physical audit workflows.
- `rooms/`: Room inventory, rate calendar, and room allocations.
- `bookings/`: Bookings management, reception counter check-ins, and housekeeping.
- `offers/`: Promotional offers and coupons management.
- `blogs/`: Spiritual media and knowledge hub content management.
- `planner/`: Yatra itinerary planner settings and circuits management.
- `local/`: Local pilgrim services hub and ecosystem management.
- `marketplace/`: Sacred merchandise marketplace and category management.
- `banner/`: Homepage & promo banners management.
- `events/`: Festival and cultural event schedules management.
- `reports/`: System audit logs and security reporting.
- `analytics/`: Financial, operational, and district onboarding analytics.
- `notifications/`: Platform push & system notification dispatch.
- `settings/`: Platform parameters and governance settings.

## Conventions

- Each module exports its public API via its `index.ts` file.
- Pages live in `<module>/pages/`.
- Components specific to a feature live in `<module>/components/`.
- Business logic, custom hooks, and API calls are scoped within each module directory.

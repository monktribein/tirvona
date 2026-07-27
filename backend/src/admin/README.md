# Backend Admin Modular Architecture (`backend/src/admin/`)

This directory houses the backend admin modular architecture for Tirvona.

## Modular Folder Structure

Each module contains standard architecture files:

```
module/
├── controller.js   # Express request handlers & controller logic
├── service.js      # Business logic & database operations
├── routes.js       # Express router definitions
├── validator.js    # Input validation schema / middlewares
├── middleware.js   # Feature-specific Express middlewares
├── permissions.js # RBAC roles & authorization rules
├── utils.js        # Helper functions & response formatters
└── index.js        # Module barrel export (default router + named exports)
```

## Available Admin Modules

1. `shared/`: Shared admin middlewares, authorization utilities, and permission matrices.
2. `dashboard/`: Overview analytics and console stats.
3. `users/`: User accounts management and status moderation.
4. `owners/`: Ashram trust owners & management.
5. `ashrams/`: Ashram verification queue and audit records.
6. `rooms/`: Room inventory and rate calendar management.
7. `bookings/`: Booking status, counter check-ins, and housekeeping.
8. `offers/`: Discount coupons and promotional campaigns.
9. `blogs/`: Content and article management.
10. `planner/`: Itinerary planner configurations.
11. `local/`: Local service providers directory.
12. `marketplace/`: Sacred merchandise marketplace hub.
13. `banner/`: Homepage promotional banner control.
14. `reports/`: Audit logs and security audit reporting.
15. `analytics/`: System metric collection and telemetry.
16. `notifications/`: Push notifications and system alerts.
17. `settings/`: Platform parameters and configuration.

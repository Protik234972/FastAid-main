# Project Knowledge

## 1. Project Overview
FastAid is an emergency response web application that connects victims/witnesses of emergencies with nearby trained first aid volunteer responders. The system enables real-time location tracking, rapid emergency dispatch, and an administrative dashboard for user and data management.

## 2. Project Objectives
- Facilitate rapid first responder dispatch within a 5km radius.
- Track emergencies through a clear state machine (`Pending` -> `Assigned` -> `On the Way` -> `Help Arrived` -> `Closed`).
- Enable live GPS tracking of volunteers for victims.
- Verify volunteer credentials before granting them operational capabilities.

## 3. Current System Scope
The system consists of:
- **Victim Mobile UI:** Mobile web app for raising alerts and tracking responders.
- **Volunteer Phone UI:** Mobile web interface streaming live GPS and receiving assignments.
- **Admin Dashboard:** Web application for verifying credentials, reviewing performance, and accessing system logs.
- **Backend API:** Node.js/Express backend providing REST endpoints, WebSocket real-time connections, role-based access control, LLM-based emergency analysis, and push notifications.

## 4. Technology Stack
- **Backend Framework:** Node.js, Express.js
- **Database:** MongoDB, Mongoose ORM
- **Real-time Communication:** Socket.IO
- **Map/Geolocation:** Leaflet, OpenStreetMap API
- **Push Notifications:** Web-Push API
- **Authentication/RBAC:** Custom Role-Based Access Control middleware (currently mock Demo Auth via `x-demo-role` headers)
- **AI/LLM Integration:** Unspecified LLM service (`../services/llm.service`)

## 5. Architecture
- Monolithic backend serving REST APIs.
- Dedicated client static pages served via `public/`.
- Event-driven Socket.IO server handling GPS broadcasts without heavy polling.
- Service-oriented router isolation (Admin, Emergency, Auth, Public).

## 6. Project Structure
- `/public/`: Frontend interfaces (`admin-dashboard/`, `victim-mobile/`, `volunteer-phone/`).
- `/src/server.js`: Application entry point.
- `/src/models/`: Mongoose schemas.
- `/src/routes/`: Express API endpoints.
- `/src/realtime/`: Socket.IO configurations.
- `/src/middleware/`: Security and RBAC controls.
- `/src/services/`: External service integrations (e.g., LLM analysis).

## 7. User Roles
1. **Victim**: Can raise emergencies, view responder locations.
2. **Volunteer**: Verified medical responders who accept emergencies and stream locations.
3. **Admin**: Platform supervisors handling verification, log viewing, and system metrics.

## 8. Authentication and Authorization
- **Current State**: Middleware utilizes a mock header `x-demo-role` for development purposes.
- **Authorization**: RBAC applied to routes enforcing `requireRole` and `requireAuthenticatedUser`.

## 9. Major Modules
- **Emergency Dispatch Module**: Assigns volunteers within a 5km radius within a 3s timeout window.
- **Volunteer Tracking Module**: Updates volunteer `lastKnownLocation` and broadcasts via WebSocket.
- **Admin Verification Module**: Certifies uploaded volunteer credentials.
- **AI Analysis Module**: Asynchronously evaluates emergency descriptions for severity and advice.

## 10. Functional Features
- **User Registration**: Mobile/email registration.
- **Emergency Requesting**: Submits description, coordinates (auto-GPS), optional photo, and runs LLM severity analysis.
- **Responder Matching**: Distance and reliability score-based sorting (limit 10-20).
- **Live Location Tracking**: Continuous GPS stream from volunteers to victims.
- **Push Notifications**: Fallback logic to SMS, timeout-based `web-push`.
- **Admin Capabilities**: Audit logs, dashboard metrics, manual volunteer verification.

## 11. Business Workflows
- **Emergency Cycle**: `Pending` -> System Matches Responders -> `Assigned` (Volunteer Accepts) -> `On the Way` -> `Help Arrived` -> `Closed`.
- **Acceptance Process**: Atomic transaction ensures no double-booking of an emergency. Unsuccessful responders receive an `EMERGENCY_TAKEN` notification.

## 12. Database/Data Model
- **User**: Core identity, contacts, push subscriptions, medical profile.
- **VolunteerProfile**: Reference to `User`, certification URL, geolocation (`2dsphere` index), reliability score.
- **Emergency**: Reference to Victim, Assigned Volunteer, Notified Responders, AI analysis embedded document, history array.
- **Payment**: Payment provider details (Bkash, Nagad), status tracking.

## 13. API Structure
- `GET /api/health`
- `GET /api/admin/*` (Metrics, certs, logs, sensitive users)
- `GET /api/public/*` (Victims/volunteers list)
- `POST /api/emergencies/requests`
- `POST /api/emergencies/:emergencyId/accept`
- `PATCH /api/emergencies/:emergencyId/status`
- `PATCH /api/emergencies/:emergencyId/cancel`

## 14. Frontend Structure
- Three specialized sub-directories representing single-page or distinct interfaces, avoiding heavy framework bloat, utilizing Leaflet maps natively.

## 15. Backend Structure
- Structured into standard MVC/Route-Controller paradigms. `fastaid.models.js` contains both schemas and business logic methods (Fat Models approach).

## 16. External Integrations
- Web-Push provider
- Leaflet map rendering
- LLM Service

## 17. Security
- Role Based Access Control middleware (`rbac.js`).
- Rate limiting on emergency creation (15 minutes / 5 max).
- MongoDB transactions to avoid assignment race conditions.

## 18. Validation and Error Handling
- Mongoose schema validation.
- Custom assertions (`assertValidObjectId`, `assertEmergencyRequestInput`).
- Timeout wrappers (`withTimeout`) preventing hanging processes.

## 19. Non-Functional Characteristics
- **Performance**: Matching latency capped at 2.5s - 3s max. Push notifications timeout at 2s.
- **Scalability**: MongoDB Geospatial `2dsphere` indexes optimize distance matching.
- **Reliability**: Atomic database operations ensure consistent state transitions.

## 20. Old SRS Requirements
- Registration, authentication, volunteer verification.
- Emergency requests via GPS with description.
- Responder matching via distance and history.
- Push and SMS notifications.
- Admin management dashboard.
- Payment management (Bkash, Nagad, Card).
- User rating and feedback for closed cases.

## 21. Modified Requirements
- **Payment Management**: Code explicitly limits providers to `['Bkash', 'Nagad']`. "Card" has been removed from the current implementation.
- **Emergency Status**: Added `Cancelled` as a valid status, previously absent.

## 22. Removed Requirements
- **Feedback & Rating**: Not present in current Mongoose schemas or backend logic.
- **Email Notifications**: Current implementation strictly utilizes `web-push` and `SMS` fallbacks.

## 23. Newly Added Requirements
- **AI Analysis**: Emergencies automatically undergo LLM evaluation generating `severity`, `keyInjuries`, and `advice` outputs.
- **Realtime WebSocket Tracking**: Live GPS streams over Socket.IO instead of static API pulls.
- **Medical Profiles**: Users have embedded medical conditions (blood type, allergies).

## 24. Partially Implemented Requirements
- **Authentication**: Currently running entirely on mock `x-demo-role` headers rather than standard JWT/Session protocols.

## 25. Known Discrepancies
- **[CONFLICT]** Old SRS required "Card" payments and "Rating" system. Current implementation lacks these.

## 26. Assumptions
- Assume the LaTeX document should reflect the current codebase (excluding Rating/Card payments or marking them as out-of-scope).
- Assume AI Analysis, Realtime Tracking, and Medical Profiles are now core system features.

## 27. Unresolved Questions
- Should the frontend be heavily emphasized in the SRS despite being lightweight "mobile views"?

## 28. SRS Generation Notes
- Will generate the LaTeX using academic structuring dictated by the SRS Rules file provided, adapting S.M.A.R.T NFRs and FRs strictly to current code bounds.

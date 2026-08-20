# Fast Responder Volunteer Network

Fast Responder Volunteer Network is a prototype emergency response web app for victims, volunteers, and admins. It includes a victim mobile emergency request UI, responder matching data models, emergency state tracking, notification fallback logic, and an admin dashboard for account and system management.

## What Is Built

### Victim Mobile View

Location: `public/victim-mobile/`

- Stress-friendly mobile interface with large readable text.
- Emergency request button reachable from the first screen.
- Minimal data entry with quick emergency type choices and one optional note field.
- Auto-GPS capture using the browser Geolocation API.
- Free Leaflet map using OpenStreetMap tiles.
- Realtime responder tracking from Socket.IO location broadcasts.

Open in the app at:

```text
http://localhost:3000/victim-mobile/
```

### Volunteer Phone Tracker

Location: `public/volunteer-phone/`

- Streams location updates to the Node.js server with Socket.IO.
- Persists valid MongoDB volunteer ObjectId locations to `VolunteerProfiles.lastKnownLocation`.
- Broadcasts every update to connected victim/admin clients.

Open on the volunteer phone at:

```text
http://localhost:3000/volunteer-phone/
```

### Admin Dashboard

Location: `public/admin-dashboard/`

- Review volunteer certification uploads.
- Approve or reject volunteer verification status.
- Monitor uptime, latency, CPU-style load, and performance alerts.
- View system logs and sensitive user records only when the current role is Admin.
- Includes a role preview selector so you can see the RBAC behavior in the UI.

Open in the app at:

```text
http://localhost:3000/admin-dashboard/
```

### Backend API

Location: `src/`

- Express application entry point: `src/server.js`
- MongoDB / Mongoose models: `src/models/fastaid.models.js`
- Admin routes: `src/routes/admin.routes.js`
- Emergency routes: `src/routes/emergency.routes.js`
- Socket.IO location handler: `src/realtime/locationSocket.js`
- RBAC middleware: `src/middleware/rbac.js`
- Demo auth middleware: `src/middleware/demoAuth.js`

Implemented backend capabilities:

- User, volunteer profile, emergency, and payment schemas.
- Emergency request creation with 5km responder matching.
- Emergency status state machine:
  - `Pending -> Assigned -> On the Way -> Help Arrived -> Closed`
- Atomic volunteer acceptance workflow to prevent double assignment.
- Push notification timeout behavior with SMS fallback hook.
- Realtime volunteer GPS updates over Socket.IO.
- Free map display with Leaflet and OpenStreetMap.
- Admin-only API protection for logs and sensitive user records.
- Health endpoint for uptime and memory visibility.

## Requirements

- Node.js 20 or newer
- npm
- MongoDB, optional for static page preview but required for database-backed API routes
- Internet access in the browser for OpenStreetMap map tiles and Leaflet CDN assets

## Setup

Install dependencies:

```bash
npm install
```

Create your environment file:

```bash
copy .env.example .env
```

On macOS/Linux use:

```bash
cp .env.example .env
```

Edit `.env`:

```text
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/fast_responder_volunteer_network
```

## Run The Web App

Start MongoDB first if you want the database routes to work.

Start the app:

```bash
npm start
```

For development with automatic restart:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000/
```

Main pages:

```text
http://localhost:3000/victim-mobile/
http://localhost:3000/volunteer-phone/
http://localhost:3000/admin-dashboard/
```

Health check:

```text
http://localhost:3000/api/health
```

## Add Demo Data To MongoDB

1. Make sure MongoDB is running.

2. Create `.env` from `.env.example`:

```bash
copy .env.example .env
```

3. Confirm `.env` contains your MongoDB URL:

```text
MONGO_URI=mongodb://127.0.0.1:27017/fast_responder_volunteer_network
```

4. Insert or update demo records:

```bash
npm run seed
```

The seed script creates:

```text
Admin:     665000000000000000000001  Mahmud Hasan
Victim:    665000000000000000000002  Sadia Akter
Victim:    665000000000000000000003  Rafi Ahmed
Volunteer: 665000000000000000000101  Ayesha Rahman
Volunteer: 665000000000000000000102  Farhan Karim
Volunteer: 665000000000000000000103  Nusrat Jahan
Emergency: 665000000000000000000201
```

Use these IDs in the web pages:

- Victim page default victim ID: `665000000000000000000002`
- Volunteer phone default volunteer ID: `665000000000000000000101`

You can also check seeded data with:

```text
http://localhost:3000/api/public/victims
http://localhost:3000/api/public/volunteers
http://localhost:3000/api/admin/dashboard-data
```

The admin endpoint uses demo RBAC. In a browser it works because the app defaults to Admin during development. With curl, pass:

```bash
curl -H "x-demo-role: Admin" http://localhost:3000/api/admin/dashboard-data
```

## Demo RBAC

The server includes demo authentication middleware for development. It reads the role from this request header:

```text
x-demo-role: Admin
```

Supported roles:

```text
Admin
Volunteer
Victim
```

Examples:

```bash
curl -H "x-demo-role: Admin" http://localhost:3000/api/admin/system-logs
curl -H "x-demo-role: Volunteer" http://localhost:3000/api/admin/system-logs
```

The first request is allowed. The second request returns `403 Forbidden`.

## Important API Routes

```text
GET    /api/health
GET    /api/admin/metrics
GET    /api/admin/certifications
PATCH  /api/admin/certifications/:profileId/review
GET    /api/admin/sensitive-users
GET    /api/admin/system-logs
GET    /api/admin/dashboard-data
GET    /api/public/victims
GET    /api/public/volunteers
POST   /api/emergencies/requests
POST   /api/emergencies/:emergencyId/accept
PATCH  /api/emergencies/:emergencyId/status
```

Database-backed routes return `503` if MongoDB is not connected.

## Realtime Location Flow

```text
Volunteer Phone
  -> Socket.IO client
  -> Node.js Socket.IO server
  -> MongoDB VolunteerProfiles.lastKnownLocation
  -> Socket.IO broadcast
  -> Leaflet Map with OpenStreetMap
```

How to test it locally:

1. Start the app with `npm start`.
2. Open `http://localhost:3000/victim-mobile/` in one browser window.
3. Open `http://localhost:3000/volunteer-phone/` on a phone or another browser window.
4. Enter a volunteer name and press `Start GPS sharing`.
5. Allow location permission.
6. Watch the victim map update as volunteer GPS changes.

If `Volunteer user ID` is a real MongoDB `User` ObjectId, the server also writes the latest location to MongoDB. Demo IDs still broadcast live but are not persisted.

## Notes For Production

Before production, replace the demo auth middleware with real authentication such as JWT or session auth. Keep RBAC checks on the backend routes even if the frontend hides admin-only screens.

Recommended next additions:

- Real Firebase Cloud Messaging or Web Push integration.
- Real SMS provider integration such as Twilio or a local gateway.
- File upload storage for volunteer certification documents.
- Dispatcher workflow for manual assignment overrides.
- Automated tests for state transitions and RBAC.
- Authentication on Socket.IO connections before accepting volunteer GPS.

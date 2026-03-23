# IPACX RIS

IPACX RIS is a web-based Radiology Information System (RIS) built with:
- Frontend: React (CRACO)
- Backend: Node.js + Express
- Database: PostgreSQL
- Integrations: PACS/Orthanc, MWL flow, PDF reporting

This README is written for client/demo and developer onboarding.

## Features

- Role-based login and protected routes
- Patient registration and patient list management
- Scheduling and Modality Worklist page
- Reporting workflow (Draft, Final, Addendum)
- Template-based reporting
- PDF generation and print/export
- PACS management
- Audit logging (login, page actions, logout, admin actions)
- Public secure report sheet route with token

## Tech Stack

- React 18 + CRACO
- React Router v6
- Axios
- Express
- PostgreSQL (`pg`)
- Multer (uploads)
- PDF generation (backend utility)

## Project Structure

```text
ipacx-ris 1.1/
|-- backend/
|   |-- server.js                  # Main backend entry
|   |-- db.js
|   |-- package.json
|   |-- routes/
|   |   |-- auth.js
|   |   |-- users.js
|   |   |-- reportedBy.js
|   |   |-- patients.js
|   |   |-- appointments.js
|   |   |-- mwl.js
|   |   |-- mwlDimse.js
|   |   |-- mwlSettings.js
|   |   |-- mwlTargets.js
|   |   |-- mwlRoutes.js
|   |   |-- pacs.js
|   |   |-- reportTemplates.js
|   |   |-- reports.js
|   |   |-- audit.js
|   |   |-- speech.js
|   |   `-- publicReportSheet.js
|   |-- services/
|   |   |-- mwlAutoPush.js
|   |   |-- mwlConnectivity.js
|   |   |-- mwlDimseExport.js
|   |   |-- mwlDimseScp.js
|   |   |-- mwlExporter.js
|   |   `-- mwlScpSync.js
|   |-- utils/
|   |   |-- auditLogger.js
|   |   `-- generateFinalReportPDF.js
|   |-- middleware/
|   |   `-- uploadSignature.js
|   |-- uploads/
|   |   |-- signatures/
|   |   `-- report_images/
|   `-- generated_pdfs/
|
|-- src/
|   |-- App.js                     # Frontend route map
|   |-- index.js
|   |-- api/
|   |   |-- axios.js
|   |   `-- urls.js
|   |-- context/
|   |   |-- AuthContext.jsx
|   |   |-- PatientContext.js
|   |   `-- StudiesContext.js
|   |-- layout/
|   |   |-- MainLayout.js
|   |   `-- MainLayout.css
|   |-- components/
|   |   |-- ProtectedRoute.js
|   |   |-- ReportPrintLayout.jsx
|   |   |-- DigitalSignatureField.jsx
|   |   `-- Login/
|   |       |-- login.js
|   |       `-- login.css
|   |-- pages/
|   |   |-- Dashboard.js
|   |   |-- PatientList.js
|   |   |-- PatientRegistration.jsx
|   |   |-- Scheduling.js
|   |   |-- MWLS.js
|   |   |-- PACSpage.jsx
|   |   |-- ReportingPage.jsx
|   |   |-- ReportPanel.jsx
|   |   |-- CreateReport.js
|   |   `-- adminsettings/
|   |       |-- UserManagement.jsx
|   |       |-- ReportedBy.jsx
|   |       |-- PacsManagement.jsx
|   |       |-- TemplateManagement.jsx
|   |       `-- AuditLogs.jsx
|   `-- utils/
|       |-- auditClient.js
|       `-- tokenUtils.js
|
|-- public/
|-- logs/
|-- schema.sql
|-- package.json                   # Frontend package
`-- README.md
```

## Environment Variables

### Backend (`backend/.env`)

Use values based on your server.

```env
PORT=5000
FRONTEND_URL=http://localhost:3000

POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
POSTGRES_DB=RIS

ORTHANC_URL=http://192.168.x.x:8042/
ORTHANC_USER=your_user
ORTHANC_PASS=your_pass

REPORT_SHEET_TOKEN=123456789
```

### Frontend (`.env` if used)

```env
REACT_APP_API_URL=http://localhost:5000
REACT_APP_API_BASE_URL=http://localhost:5000
```

## Local Setup

## 1) Install frontend dependencies

```bash
npm install
```

## 2) Install backend dependencies

```bash
cd backend
npm install
cd ..
```

## 3) Run backend

```bash
cd backend
node server.js
```

Backend starts on `http://localhost:5000`.

## 4) Run frontend

Open a new terminal in project root:

```bash
npm start
```

Frontend starts on `http://localhost:3000`.

## Build

```bash
npm run build
```

## Main Workflows

- Patient registration -> Scheduling
- Scheduling -> MWL page
- Reporting -> Draft/Final/Addendum
- Final/Addendum -> PDF preview/print
- User activity -> Audit Logs

## Important Routes

- Frontend:
  - `/` login
  - `/dashboard`
  - `/patient-list`
  - `/scheduling`
  - `/mwls`
  - `/reporting`
  - `/report-panel?study=<StudyUID>`
  - `/admin/*`
  - `/secure-report-sheet?k=<token>`

- Backend:
  - `/api/login`
  - `/api/reports`
  - `/api/reports/save`
  - `/api/reports/:id/pdf`
  - `/api/pacs/*`
  - `/api/mwl/*`
  - `/api/mwl-dimse/*`
  - `/api/mwl-settings/*`
  - `/api/mwl-targets/*`
  - `/api/audit/*`
  - `/api/public/report-sheet/*`

## Logs

- Runtime logs can be written to:
  - `logs/frontend.log`
  - `logs/backend.log`
- Generated PDFs are stored under:
  - `backend/generated_pdfs/`

## Troubleshooting

- CORS errors:
  - Verify `FRONTEND_URL` and allowed LAN origin settings in `backend/server.js`.
- API not reachable from another system:
  - Use server LAN IP, not `localhost`, and confirm firewall/network access.
- PDF preview missing patient fields on addendum:
  - Ensure backend is restarted with latest routes.
- Audit logs not loading:
  - Confirm backend is running and `/api/audit/logs` is reachable.

## Security Notes

- Do not commit real `.env` credentials.
- Public report sheet token should be rotated in production.
- Prefer HTTPS in production (reverse proxy with valid TLS certificate).

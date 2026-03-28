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

This list includes **all tracked files** and source files, excluding large runtime artifacts: `node_modules/`, `build/`, `logs/`, `backend/uploads/`, `backend/generated_pdfs/`, and `backend/routes/uploads/`.

```text
ipacx-ris 1.1
|-- backend
|   |-- controllers
|   |   |-- appointmentsController.js
|   |   |-- auditController.js
|   |   |-- authController.js
|   |   |-- modalitiesController.js
|   |   |-- mwlController.js
|   |   |-- mwlControllerV2.js
|   |   |-- mwlDimseController.js
|   |   |-- mwlSettingsController.js
|   |   |-- mwlTargetsController.js
|   |   |-- pacsController.js
|   |   |-- patientsController.js
|   |   |-- publicReportSheetController.js
|   |   |-- reportedByController.js
|   |   |-- reportsController.js
|   |   |-- reportTemplatesController.js
|   |   |-- speechController.js
|   |   |-- studiesController.js
|   |   +-- usersController.js
|   |-- db.js
|   |-- generateHash.js
|   |-- middleware
|   |   |-- auditlog.js
|   |   |-- auth.js
|   |   |-- roles.js
|   |   +-- uploadSignature.js
|   |-- package.json
|   |-- package-lock.json
|   |-- routes
|   |   |-- appointments.js
|   |   |-- audit.js
|   |   |-- auth.js
|   |   |-- modalities.js
|   |   |-- mwl.js
|   |   |-- mwlDimse.js
|   |   |-- mwlRoutes.js
|   |   |-- mwlSettings.js
|   |   |-- mwlTargets.js
|   |   |-- pacs.js
|   |   |-- patients.js
|   |   |-- publicReportSheet.js
|   |   |-- reportedBy.js
|   |   |-- reports.js
|   |   |-- reportTemplates.js
|   |   |-- speech.js
|   |   |-- studies.js
|   |   +-- users.js
|   |-- server.js
|   |-- services
|   |   |-- appointmentsService.js
|   |   |-- auditService.js
|   |   |-- authService.js
|   |   |-- modalitiesService.js
|   |   |-- mwlAutoPush.js
|   |   |-- mwlConnectivity.js
|   |   |-- mwlDimseExport.js
|   |   |-- mwlDimseScp.js
|   |   |-- mwlDimseService.js
|   |   |-- mwlExporter.js
|   |   |-- mwlScpSync.js
|   |   |-- mwlSettingsService.js
|   |   |-- mwlTargetsService.js
|   |   |-- pacsService.js
|   |   |-- publicReportSheetService.js
|   |   |-- reportedByService.js
|   |   |-- reportTemplatesService.js
|   |   |-- speechService.js
|   |   |-- studiesService.js
|   |   +-- usersService.js
|   +-- utils
|       |-- auditLogger.js
|       |-- generateFinalReportPDF.js
|       +-- mwlLogger.js
|-- craco.config.js
|-- package.json
|-- package-lock.json
|-- postcss.config.js
|-- public
|   |-- favicon.ico
|   |-- index.html
|   |-- logo192.png
|   |-- logo512.png
|   |-- manifest.json
|   +-- robots.txt
|-- README.md
|-- schema.sql
|-- src
|   |-- api
|   |   |-- axios.js
|   |   +-- urls.js
|   |-- App.js
|   |-- App.test.js
|   |-- components
|   |   |-- CustomDatePicker.css
|   |   |-- CustomDatePicker.js
|   |   |-- DigitalSignatureField.jsx
|   |   |-- Login
|   |   |   |-- login.css
|   |   |   +-- login.js
|   |   |-- LoginRedirect.jsx
|   |   |-- ProtectedRoute.js
|   |   |-- ReportPrintLayout.jsx
|   |   +-- StudiesTable.jsx
|   |-- context
|   |   |-- AuthContext.jsx
|   |   |-- PatientContext.js
|   |   +-- StudiesContext.js
|   |-- hooks
|   |   +-- useIdleTimer.js
|   |-- index.css
|   |-- index.js
|   |-- layout
|   |   |-- MainLayout.css
|   |   +-- MainLayout.js
|   |-- logo.svg
|   |-- pages
|   |   |-- AddendumReport.jsx
|   |   |-- AddNewReportPage.js
|   |   |-- AddPatient.css
|   |   |-- AddPatient.js
|   |   |-- AddScheduler.css
|   |   |-- AddScheduler.js
|   |   |-- adminsettings
|   |   |   |-- AuditLogs.css
|   |   |   |-- AuditLogs.jsx
|   |   |   |-- MwlsManagement.css
|   |   |   |-- MwlsManagement.jsx
|   |   |   |-- PacsManagement.css
|   |   |   |-- PacsManagement.jsx
|   |   |   |-- ReportedBy.jsx
|   |   |   |-- TemplateManagement.css
|   |   |   |-- TemplateManagement.jsx
|   |   |   |-- UserManagement.css
|   |   |   +-- UserManagement.jsx
|   |   |-- Billing.jsx
|   |   |-- CreateReport.css
|   |   |-- CreateReport.js
|   |   |-- Dashboard.css
|   |   |-- Dashboard.js
|   |   |-- MWLS.css
|   |   |-- MWLS.js
|   |   |-- PACSpage.css
|   |   |-- PACSpage.jsx
|   |   |-- PatientList.css
|   |   |-- PatientList.js
|   |   |-- PatientRegistration.css
|   |   |-- PatientRegistration.jsx
|   |   |-- ReportingPage.css
|   |   |-- ReportingPage.jsx
|   |   |-- ReportPanel.css
|   |   |-- ReportPanel.jsx
|   |   |-- Scheduling.css
|   |   +-- Scheduling.js
|   |-- print.css
|   |-- reportWebVitals.js
|   |-- services
|   |   +-- axiosInstance.js
|   |-- setupTests.js
|   +-- utils
|       |-- auditClient.js
|       +-- tokenUtils.js
+-- tailwind.config.js
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

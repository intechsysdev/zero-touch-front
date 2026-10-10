# Zero-touch Web Console

Web application for client login (Client ID through Intechsys One), device inventory, bulk claim (Zero-touch & Samsung Knox), and unclaim management via the Zero-touch API.

## Tech Stack

- **React 18** + **TypeScript**
- **Vite**
- **react-qr-barcode-scanner** (QR/Barcode camera scanning)

## Environment Setup

The application connects to the backend API configured via `VITE_BACKEND_BASE_URL`.

- Template: `.env.example`
- Development: `.env.development`
- Production: `.env.production`

Create your local `.env` if needed:

```bash
cp .env.example .env
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview production build:

```bash
npm run preview
```

## Azure Static Web Apps CI/CD

Deployment is automated via GitHub Actions:

- Workflow: `.github/workflows/deploy-azure-static-web-apps.yml`

### Required GitHub Repository Secrets

Configure the following secrets in **Settings > Secrets and variables > Actions**:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Deployment token from Azure Static Web Apps.
- `VITE_ONE_FRONTEND_URL` (optional): One portal, where users sign in. Defaults to production.
- `VITE_BACKEND_BASE_URL`: URL of the deployed backend API (e.g. `https://app-zerotouch-api-prd-a4cgg3amfecgbear.centralus-01.azurewebsites.net`).

## Sign-in

The user types their **Client ID**; the console sends them to Intechsys One (`/autorizar` with
`tenant_hint=<Client ID>`). One authenticates them and opens the console with the company that has
that Client ID as its zero-touch variable. Register `https://<console>/sso/callback` as a redirect
URI of the `zero-touch` app in One, and `https://<console>/sso` as its launch URL.

## Backend API Endpoints Used

- `POST /api/v1/sso/token`, `POST /api/v1/sso/logout`: One code exchange and logout (forwarded by the API)
- `GET /api/v1/sesion`: user, companies and active company with its Client ID and platforms
- `GET /zerotouch/devices`: List Android Zero-touch devices
- `POST /zerotouch/devices/claim/bulk`: Bulk claim Zero-touch devices
- `POST /zerotouch/devices/unclaim`: Unclaim Zero-touch device
- `GET /zerotouch/devices/identifier-options`: Available manufacturers and models
- `GET /samsung/devices`: List Samsung Knox devices
- `POST /samsung/devices/claim/bulk`: Bulk claim Samsung Knox devices
- `POST /samsung/devices/unclaim`: Unclaim Samsung Knox device

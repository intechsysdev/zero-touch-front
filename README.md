# Zero-touch Web Console

Web app for login by `clientId`, list devices, claim, and unclaim using the backend API.

## Environment

The app reads backend URL from `VITE_BACKEND_BASE_URL`.

- Development: `.env.development`
- Production: `.env.production`
- Template: `.env.example`

## Commands

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Azure Static Web Apps CI/CD

Workflow file:

- `../.github/workflows/deploy-azure-static-web-apps.yml`

Required GitHub repository secrets:

- `AZURE_STATIC_WEB_APPS_API_TOKEN`
- `VITE_BACKEND_BASE_URL`

The workflow builds the app and deploys the `dist/` folder to Azure Static Web Apps.

## Backend contract

This frontend uses these endpoints:

- `POST /auth/login`
- `GET /zerotouch/devices`
- `POST /zerotouch/devices/claim`
- `POST /zerotouch/devices/unclaim`

## Device identifier rules

To claim a device, the form must send one of these valid sets:

- `imei`
- `serialNumber + manufacturer + model`

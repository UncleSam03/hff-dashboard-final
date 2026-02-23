# Workspace Setup Guide: HFF Dashboard

This document records the steps to set up the HFF Dashboard development environment.

## 1. Prerequisites
- **Node.js**: Ensure you have Node.js installed (LTS recommended).
- **Package Installation**: Run `npm install` in the project root.

## 2. Environment Configuration
Create a `.env.local` file in the root directory:

```env
# Backend API Port
HFF_API_PORT=8787

# Google Sheets Integration
HFF_SPREADSHEET_ID=1-_DBEqc6HRwl-krtjP2jMboWDNq6PZkul99WDXTljJY
HFF_REGISTER_SHEET_NAME=Register

# Supabase Auth
VITE_SUPABASE_URL=https://kbmyukfgusldmljbponu.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## 3. Google Sheets Integration
1. **Service Account**: A Google Cloud service account JSON file (e.g., `hff-dashboard-*.json`) must be placed in the project root.
2. **Permissions**: Copy the `client_email` from the JSON file and share your Google Spreadsheet with it as an **Editor**.

## 4. Supabase Authentication
- The project uses Supabase for authentication.
- Ensure the `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are correctly set in `.env.local`.
- Authentication logic is handled in `src/auth/` and `src/lib/supabase.js`.

## 5. Running the Application
Open two separate terminals:

### Terminal 1: Backend API
```bash
npm run dev:api
```

### Terminal 2: Frontend (Vite)
```bash
npm run dev
```

The application will be available at [http://localhost:5173](http://localhost:5173).

## 6. Granting AI Assistant Permissions
To allow the AI assistant (Antigravity) to run terminal commands, run diagnosis, or perform builds:
1. Look for the folder `c:\Users\samuk\Documents\HFF system\hff-dashboard` in your editor's sidebar.
2. If prompted, click **"Set as Active Workspace"**.
3. This grants the agent permission to use the `run_command` tool within this directory.

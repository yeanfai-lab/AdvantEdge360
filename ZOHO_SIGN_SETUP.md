# Zoho Sign Setup Instructions

## Step 1: Create Zoho Account & App

1. **Go to Zoho API Console**
   - Visit: https://api-console.zoho.com/
   - Sign in or create a Zoho account

2. **Create a New Client**
   - Click "Add Client" → "Server-based Applications"
   - Fill in:
     * Client Name: `AdvantEdge360`
     * Homepage URL: Your app URL (e.g., `https://your-app.emergentagent.com`)
     * Authorized Redirect URIs: `https://your-app.emergentagent.com/api/zoho/callback`
   - Click "Create"
   - **Save** your `Client ID` and `Client Secret`

## Step 2: Enable Zoho Sign API

1. In the API Console, select your client
2. Go to "Scopes" tab
3. Add these scopes:
   - `ZohoSign.documents.CREATE`
   - `ZohoSign.documents.READ`
   - `ZohoSign.documents.UPDATE`
   - `ZohoSign.templates.READ`

## Step 3: Get Self Client Credentials

1. Click "Generate Code" with the scopes selected
2. Choose Time Duration: 3 minutes
3. Copy the generated code
4. Exchange code for tokens using:

```bash
curl -X POST https://accounts.zoho.com/oauth/v2/token \
  -d "code=YOUR_GENERATED_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=https://your-app.emergentagent.com/api/zoho/callback" \
  -d "grant_type=authorization_code"
```

5. Save the `refresh_token` from response

## Step 4: Add to .env

```bash
ZOHO_CLIENT_ID=your_client_id
ZOHO_CLIENT_SECRET=your_client_secret
ZOHO_REFRESH_TOKEN=your_refresh_token
ZOHO_REGION=com  # or 'eu', 'in', 'au' based on your region
```

## API Endpoints You'll Use

- Send for signature: `POST https://sign.zoho.{region}/api/v1/requests`
- Check status: `GET https://sign.zoho.{region}/api/v1/requests/{request_id}`
- Download signed: `GET https://sign.zoho.{region}/api/v1/requests/{request_id}/pdf`

## Rate Limits

- 100 requests per minute
- 10,000 requests per day

---

**Note**: The app is currently in DEMO MODE. When you're ready to go live:
1. Add the credentials to `/app/backend/.env`
2. Restart backend: `sudo supervisorctl restart backend`
3. The system will automatically switch from demo to real API calls

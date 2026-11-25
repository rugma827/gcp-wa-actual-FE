# Frontend

React + Vite app.

## Run locally

```bash
npm install
npm run start
```

Runs on http://localhost:5173

## Other commands

```bash
npm run build    # production build
npm run preview  # preview production build
```

## Deploy to Cloud Run

### 1. Set your GCP project

```bash
gcloud config set project agentic-wealthadvisor
```

### 2. Build & push image via Cloud Build

```bash
gcloud builds submit \
  --tag gcr.io/agentic-wealthadvisor/wa-frontend \
  --build-arg VITE_BACKEND_URL=https://wa-backend-675909555324.us-west1.run.app \
  --build-arg VITE_WS_BASE_URL=wss://wa-backend-675909555324.us-west1.run.app/api \
  --build-arg VITE_FIREBASE_API_KEY=AIzaSyB2GpPKkxVrYgqPAlTLhEEvJWDfvirDXeY \
  --build-arg VITE_FIREBASE_AUTH_DOMAIN=agentic-wealthadvisor.firebaseapp.com \
  --build-arg VITE_FIREBASE_PROJECT_ID=agentic-wealthadvisor \
  --build-arg VITE_DUMMY_UI=true \
  --build-arg FLAG_CIA_GRAPH_SYNC=true
```

> Set `VITE_DUMMY_UI=false` when backend is ready.

### 3. Deploy to Cloud Run

```bash
gcloud run deploy wa-frontend \
  --image gcr.io/agentic-wealthadvisor/wa-frontend \
  --platform managed \
  --region us-west1 \
  --allow-unauthenticated \
  --port 8080
```

### 4. Get the URL

Cloud Run prints the URL after deploy:

```
Service URL: https://wa-frontend-xxxxxxxxxx-uw.a.run.app
```

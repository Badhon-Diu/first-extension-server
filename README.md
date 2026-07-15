# Student Mark Extraction API

An AI-powered API server that extracts student marks from **voice recordings** and **scanned test paper images**. This server acts as a proxy — it receives requests from a browser extension and forwards them to dedicated external Audio and Image APIs for AI processing.

---

## Architecture

```
Browser Extension
       │
       ▼
┌──────────────────┐
│   Main Server    │  (this project — Express.js)
│  (Proxy/Forward) │
└──────┬──────┬────┘
       │      │
       ▼      ▼
┌────────┐ ┌────────┐
│ Audio  │ │ Image  │
│  API   │ │  API   │
│ (Groq) │ │(Model  │
│        │ │ Scope) │
└────────┘ └────────┘
```

- **Audio API** (`https://audio-api-t72c.onrender.com/transcribe`) — Transcribes audio with Whisper + extracts marks with Llama 3.1
- **Image API** (`https://image-api-u5dy.onrender.com/api/analyze-images`) — Reads test paper images with Qwen3.5 vision model

---

## Tech Stack

| Tool | Purpose |
|------|---------|
| **Express.js** | Web server framework |
| **Multer** | Handles file uploads |
| **EJS** | Template engine for mobile upload page |
| **Render** | Cloud deployment platform |

---

## Local Setup

### Prerequisites
- Node.js >= 18

### Step 1 — Clone and install
```bash
npm install
```

### Step 2 — Create `.env` file
```env
AUDIO_API_URL=https://audio-api-t72c.onrender.com
IMAGE_API_URL=https://image-api-u5dy.onrender.com/api/analyze-images
```

### Step 3 — Start server
```bash
npm start        # production
npm run dev      # development (auto-restart with nodemon)
```

Server runs at: **`http://localhost:3001`**

---

## API Reference

### `POST /api/analyze-audio`

Accepts base64-encoded audio from the browser extension and returns extracted student marks.

**Request** (JSON body):

```json
{
  "audio": "<base64 encoded audio data>",
  "assessment": "quiz1",
  "students": [
    { "id": "232-15-045", "name": "Rahim" },
    { "id": "232-15-380", "name": "Karim" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | string | Yes | Base64-encoded audio (webm) |
| `assessment` | string | No | Exam type (quiz1, midterm, final) |
| `students` | array | No | Known student list for fuzzy matching |

**Response:**

```json
[
  { "student id": "232-15-045", "mark": 8 },
  { "student id": "232-15-380", "mark": 13 }
]
```

**How it works:**
1. Decodes base64 audio to a temp `.webm` file
2. Forwards the file to the **Audio API** (`/transcribe`)
3. If `students` array is provided, includes it as `dataset` field — Audio API uses fuzzy matching (`matchToDataset`) to map spoken names/partial IDs to known student IDs
4. Returns the result and cleans up the temp file

---

### `POST /api/analyze-images`

Accepts scanned test paper images and returns extracted student IDs and marks.

**Request** (multipart/form-data):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `images` | File(s) | Yes | Up to 10 images (jpg, png, webp, gif) |
| `students` | string | No | JSON string: `[{"id":"...","name":"..."}]` |

**Example using curl:**
```bash
curl -X POST http://localhost:3001/api/analyze-images \
  -F "images=@paper1.jpg" \
  -F "images=@paper2.jpg" \
  -F 'students=[{"id":"232-15-045","name":"Rahim"}]'
```

**Response:**

```json
[
  { "student id": "232-15-045", "mark": 17 },
  { "student id": "232-15-380", "mark": 15 }
]
```

**How it works:**
1. Receives images in memory via Multer
2. Forwards all images + optional student context to the **Image API**
3. Image API processes images with vision model (Qwen3.5) and returns results

---

### `GET /api/health`

Checks if the server is running.

```json
{
  "status": "ok",
  "timestamp": "2026-07-15T12:00:00.000Z"
}
```

---

### `GET /api/network-info`

Returns LAN IP for QR code generation (used by the browser extension).

```json
{
  "lanIp": "192.168.1.5",
  "port": 3001,
  "baseUrl": "http://192.168.1.5:3001"
}
```

---

### Mobile Upload Session (Teacher's Phone)

Teachers can capture mark sheet photos from their phone and batch-process them.

#### `GET /upload/:uuid`

Serves a mobile-friendly EJS page for capturing/photos.

#### `POST /upload/:uuid/images`

Upload images from mobile to a session.

**Response:**
```json
{ "success": true, "uploaded": 3, "total": 8 }
```

#### `GET /api/session/:uuid`

List all uploaded images in a session.

```json
{
  "uuid": "abc123",
  "count": 5,
  "files": ["img-1.jpg", "img-2.jpg"]
}
```

#### `POST /api/session/:uuid/analyze`

Process all session images through the Image API.

**Response:**
```json
[
  { "student id": "232-15-045", "mark": 17 }
]
```

---

## Student Dataset Matching (Audio)

When the `students` array is provided with audio requests, the **Audio API** performs fuzzy matching with this priority:

| Priority | Match Type | Example |
|----------|------------|---------|
| 1 | Exact name match | "Rahim" → ID: 232-15-045 |
| 2 | Exact full ID match | "232-15-045" → ID: 232-15-045 |
| 3 | Last 4 digits of ID | "5045" → ID: 232-15-045 |
| 4 | Last 3 digits of ID | "045" → ID: 232-15-045 |
| 5 | Partial ID contains (>=5 chars) | "15045" → ID: 232-15-045 |
| 6 | Fuzzy name match (Levenshtein, threshold 70%) | "Rahm" → ID: 232-15-045 |

---

## Deployment to Render

### Step 1 — Push to GitHub
```bash
git add .
git commit -m "initial commit"
git push
```

### Step 2 — Create Web Service on Render
1. Go to [render.com](https://render.com) and log in
2. Click **New +** → **Web Service**
3. Connect your GitHub repository
4. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `student-mark-api` |
| **Region** | Choose closest to you |
| **Branch** | `main` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `node server.js` |
| **Plan** | Free |

### Step 3 — Add Environment Variables
In Render dashboard → **Environment** section, add:

| Name | Value |
|------|-------|
| `AUDIO_API_URL` | `https://audio-api-t72c.onrender.com` |
| `IMAGE_API_URL` | `https://image-api-u5dy.onrender.com/api/analyze-images` |

### Step 4 — Deploy
Click **Create Web Service**. Render will build and deploy automatically.

After deployment, your API will be available at:
```
https://<your-app-name>.onrender.com/api/health
```

---

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `"No audio data provided"` | Empty or missing `audio` field | Send base64 audio in JSON body |
| `"No images provided"` | No files under `images` field | Use multipart/form-data with key `images` |
| `"Failed to analyze audio"` | Audio API unreachable or error | Check `AUDIO_API_URL` env variable |
| `500 Internal Server Error` | External API error | Check Render logs for details |
| Server doesn't start | Missing `.env` or dependencies | Run `npm install` and check `.env` file |

---

## Project Structure

```
├── .env                  # Environment variables (API URLs)
├── .gitignore
├── app.js                # Express app setup, middleware, routes
├── package.json
├── server.js             # Entry point — starts HTTP server
├── vercel.json           # (Optional — for Vercel deployment)
├── views/
│   └── upload.ejs        # Mobile photo upload page
├── apiscode/             # Standalone API code (Audio + Image APIs)
│   ├── audio-api.js      # Groq-based Audio API
│   └── imageapi.js       # ModelScope-based Image API
└── src/
    ├── config/index.js           # Configuration
    ├── middleware/upload.js       # Multer file upload config
    ├── routes/
    │   ├── audio.route.js        # POST /api/analyze-audio
    │   ├── health.route.js       # GET /api/health
    │   ├── image.route.js        # POST /api/analyze-images
    │   ├── session.route.js      # GET/POST /api/session/:uuid
    │   └── upload.route.js       # GET/POST /upload/:uuid
    ├── services/
    │   ├── audio.service.js      # Forwards audio to Audio API
    │   └── image.service.js      # Forwards images to Image API
    └── utils/helpers.js          # Utility functions
```

---

## License

MIT

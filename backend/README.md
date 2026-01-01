# Zero-Stress Sales Backend Server

Backend server for the Zero-Stress Sales Closer Co-Pilot application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001
WS_PORT=3001
NODE_ENV=development
```

3. Build TypeScript:
```bash
npm run build
```

4. Run in development mode:
```bash
npm run dev
```

Or run in production:
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check endpoint

## WebSocket

The server runs a WebSocket server on the same port (default: 3001).

### WebSocket Messages

**Client → Server:**
- `{ type: "transcript", text: string, speaker?: "closer" | "prospect" | "unknown" }` - Send conversation transcript
- `{ type: "analyze" }` - Request immediate analysis
- `{ type: "audio", data: string }` - Send audio data (base64 encoded)

**Server → Client:**
- `{ type: "session", sessionId: string }` - Session established
- `{ type: "analysis", data: AnalysisResult }` - Analysis results (sent periodically and on request)
- `{ type: "error", error: string }` - Error occurred

## Architecture

The backend analyzes conversations using CSV-defined sales logic:

1. **CSV Parser** - Loads all sales logic from CSV files
2. **Indicator Scorer** - Scores 27 indicators (1-10) based on conversation
3. **Pillar Calculator** - Calculates 7 pillar scores with weights
4. **Lubometer Calculator** - Calculates final readiness score and price tier readiness
5. **Truth Index Calculator** - Detects incoherences and calculates truth score
6. **Objection Detector** - Identifies likely objections
7. **Psychological Dials Analyzer** - Analyzes psychological patterns
8. **Red Flags Detector** - Identifies potential risks
9. **Analysis Engine** - Orchestrates all services

## CSV Files Required

The server expects CSV files in the project root:
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillars.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Pillar 1.csv` through `Pillar 7.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Lubometer Formula.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Truth Index.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Indicators and Objection Matrix.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Hot Buttons Tracker.csv`
- `Copy of Zero-Stress Sales Logic - Dec 2025 V1 - Push_Delay Rules.csv`


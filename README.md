# AttendanceRepository

AttendanceRepository is a full-stack attendance workbook repository built with Go, Gin, GORM, SQLite, Redis, React, TypeScript, Vite, Tailwind CSS, and Excelize.

## Features

- Admin authentication with JWT cookies
- Upload and preview `.xlsx` attendance workbooks
- Store workbook sheets and rows in SQLite
- Edit repository metadata and workbook contents
- Download stored attendance data as Excel workbooks
- Optional Redis caching for repository listings
- React dashboard powered by Vite
- Production frontend served by the Go application
- Multi-stage Docker production build

## Requirements

- Go 1.23 or later
- Node.js 22 or later
- npm
- Redis, optional

## Installation

From the repository root, install the frontend and Go dependencies:

```bash
npm run setup
```

This runs:

```bash
npm install
go mod tidy
go mod download
```

## Environment Configuration

Create a root `.env` file:

```env
PORT=8080
APP_TIMEZONE=Asia/Manila
DATABASE_PATH=./data/attendance.db
MAX_UPLOAD_BYTES=15728640
PREVIEW_TTL=30m
SESSION_DURATION=12h
JWT_SECRET=replace-with-a-long-random-secret
AUTH_COOKIE_NAME=attendance_token
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=replace-with-a-secure-password
FRONTEND_ORIGIN=http://localhost:5173
REDIS_ADDR=localhost:6379
REDIS_PASSWORD=
REDIS_DB=0
```

Change `JWT_SECRET` and `ADMIN_PASSWORD` before deployment. Do not commit production secrets.

Redis is optional. Leave `REDIS_ADDR` empty when Redis is unavailable.

## Development

Start the backend and frontend together:

```bash
npm run dev
```

Development URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8080`
- Health check: `http://localhost:8080/api/health`

The Vite development server proxies `/api` requests to the Go backend.

Start either service separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Build

Build the frontend and backend:

```bash
npm run build
```

Generated output:

```text
view/dist
bin/attendance
```

Run the compiled application:

```bash
./bin/attendance
```

## Available Commands

| Command | Description |
| --- | --- |
| `npm run setup` | Install npm dependencies and synchronize Go modules |
| `npm run deps:go` | Run `go mod tidy` and `go mod download` |
| `npm run clean:generated` | Remove generated TypeScript build files |
| `npm run dev` | Start backend and frontend development servers |
| `npm run dev:backend` | Start only the Go backend |
| `npm run dev:frontend` | Start only the Vite frontend |
| `npm run build` | Build the frontend and Go binary |
| `npm run start` | Run the Go application |
| `npm run lint` | Run Go vet and frontend linting |
| `npm run format` | Format Go, TypeScript, TSX, and CSS files |

## Docker

Build the production image:

```bash
docker build -t attendance-repository .
```

Run the container:

```bash
docker run --rm \
  -p 8080:8080 \
  --env-file .env \
  attendance-repository
```

Persist SQLite data with a Docker volume:

```bash
docker run --rm \
  -p 8080:8080 \
  --env-file .env \
  -v attendance-data:/app/data \
  attendance-repository
```

## VS Code Configuration

Create `.vscode/settings.json` and use the workspace TypeScript installation:

```json
{
  "css.lint.unknownAtRules": "ignore",
  "scss.lint.unknownAtRules": "ignore",
  "less.lint.unknownAtRules": "ignore",
  "js/ts.tsdk.path": "view/node_modules/typescript/lib",
  "js/ts.tsdk.promptToUseWorkspaceVersion": true,
  "go.useLanguageServer": true,
  "go.toolsEnvVars": {
    "GOFLAGS": "-mod=mod"
  },
  "gopls": {
    "buildFlags": [
      "-mod=mod"
    ]
  },
  "files.exclude": {
    "**/*.tsbuildinfo": true,
    "view/vite.config.js": true,
    "view/vite.config.d.ts": true,
    "view/tailwind.config.js": true,
    "view/tailwind.config.d.ts": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/*.tsbuildinfo": true,
    "view/dist": true
  }
}
```

Open a `.ts` or `.tsx` file, press `Ctrl+Shift+P`, run `TypeScript: Select TypeScript Version`, and select `Use Workspace Version`.

## TypeScript Troubleshooting

If stale TypeScript build metadata causes configuration errors, run:

```bash
npm run clean:generated
```

The current `view/tsconfig.node.json` uses `noEmit: true`, which is compatible with Vite configuration files. If VS Code still reports an `allowImportingTsExtensions` error, restart the TypeScript server from the Command Palette and reload the VS Code window.

## Go Module Troubleshooting

If VS Code or `gopls` reports missing import metadata, synchronize the Go module graph:

```bash
npm run deps:go
```

The equivalent commands are:

```bash
go mod tidy
go mod download
```

## Project Structure

```text
.
├── config/                 Application configuration
├── controller/             HTTP controllers
├── database/               SQLite and Redis integration
├── middleware/             Authentication middleware
├── model/                  Database and workbook models
├── service/                Excel parsing, generation, and preview storage
├── view/                   React and Vite frontend
├── main.go                 Application entry point and routes
├── Dockerfile              Production container build
├── go.mod                  Go module definition
└── package.json            Root workspace scripts
```

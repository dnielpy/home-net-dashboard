# Home Net Dashboard

Full stack app to monitor the home internet link. Every 30 seconds the API pings each hop of the chain and reads the traffic counters of the Nano:

```
Router (10.40.43.100) → Nano Loco 5AC (10.40.43.99) → Provider AP (10.40.43.125) → Internet (1.1.1.1)
```

The connection is cut right after the last hop that answers. The dashboard shows the chain live; the stats page shows online/offline history, outages (with the hop where the chain broke) and bandwidth used.

## Structure

```
apps/
  api/   FastAPI backend: pings the hops, reads the Nano (airOS 8) and stores checks and traffic in Postgres
  web/   Next.js frontend
docker-compose.yml   Postgres for local development
turbo.json           Task runner config (Turborepo)
```

Tasks are orchestrated with [Turborepo](https://turborepo.com/). The API is a Python project, but it has a small `package.json` so Turborepo can run its tasks like any other workspace package.

## Requirements

- [uv](https://docs.astral.sh/uv/) (Python 3.12 is downloaded automatically)
- Node.js 24 and [pnpm](https://pnpm.io/) 11
- Docker

## Setup

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm install
cd apps/api && uv sync && cd ../..
pnpm db:up
pnpm db:migrate
```

Set `NANO_USERNAME` and `NANO_PASSWORD` in `apps/api/.env` (the Nano's web UI login). The hop IPs default to the ones above; change them with `ROUTER_IP`, `NANO_IP`, `PROVIDER_IP` and `INTERNET_IP`.

## Development

```bash
pnpm dev
```

- API: http://localhost:3011 (Swagger at http://localhost:3011/docs)
- Web: http://localhost:3010 
- Postgres: localhost:5434

Ports are chosen so it can run next to the Bluetti project on the same machine.

`pnpm db:seed` adds 30 days of simulated checks and traffic (`-- --days N` to change it) to work on the UI. It only fills the time before the data already stored, so the latest traffic sample stays the real one. `-- --replace` deletes those days first and seeds up to now; delete the simulated `traffic_sample` rows before collecting real traffic again, or the first real sample is compared with a simulated counter.

## API

| Endpoint | Description |
|---|---|
| `GET /connection/hops` | The hops of the chain in order, with their IPs |
| `GET /connection/live/{hop}` | Pings one hop once a second for about 3 seconds; the dashboard walks the chain with it |
| `GET /connection/live` | Pings every hop now: `online`, `break_at` and each hop's latency |
| `GET /connection/latest` | The latest check stored by the background job; the dashboard shows it on load |
| `GET /speed-test/latest` | The latest stored speed test |
| `POST /speed-test` | Measures download speed with fast.com through [`fast-test-cli`](https://www.npmjs.com/package/fast-test-cli), streaming the speed as NDJSON while it measures (10–30 s) |
| `GET /connection-status` | State according to the latest check, since when, last outage / last period online |
| `GET /connection-history?hours=24` | Periods online, offline and without checks |
| `GET /outages?hours=24` | Outages with duration and the hop where the chain broke |
| `GET /bandwidth?hours=24&bucket=hour` | Bytes downloaded and uploaded per hour or day (`hours` up to 720) |
| `GET /health`, `GET /health/db` | Health checks |

Traffic comes from the Nano's wireless station counters (`/status.cgi`). Each sample stores the difference with the previous one; when the Nano's uptime goes down it rebooted, so the counter is counted from zero.

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run the API and the web app with auto reload |
| `pnpm dev:api` | Run only the API |
| `pnpm dev:web` | Run only the web app |
| `pnpm build` | Build every app that has a build step |
| `pnpm lint` | Lint every app that has a lint step |
| `pnpm test` | Run every app's tests |
| `pnpm db:up` | Start Postgres |
| `pnpm db:down` | Stop Postgres |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:seed` | Add 30 days of simulated data before the stored data (`-- --days N`, `-- --replace`) |

## Production (Docker)

Production runs the API, the web app and Postgres with `docker-compose.prod.yml`, on a Linux host inside the home network (the server behind the router).

```bash
cp .env.production.example .env.production
```

Edit `.env.production`: set a strong `POSTGRES_PASSWORD` and the Nano's `NANO_USERNAME` / `NANO_PASSWORD`. Then:

```bash
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build
```

To update a running deployment later, run `./scripts/update.sh`: it stops the containers, runs `git pull` and builds and starts them again, waiting until they are healthy. The database volume is kept.

- Web: http://HOST:3010 · API: http://HOST:3011 (ports set by `WEB_PORT` / `API_PORT`)
- Postgres is not published outside the Docker network.
- The API runs a speed test every `SPEED_TEST_INTERVAL_SECONDS` (default 600, about 1.4 GB a day on a 5 Mbps link; 0 turns it off) and stores it, so opening the dashboard never measures.
- The API image ships Node and `fast-test-cli` for the speed test. Outside Docker, install it with `npm install --global fast-test-cli` (or set `FAST_CLI` to its `cli.js`).
- The API sends pings without root through unprivileged ICMP sockets, enabled for the container with the `net.ipv4.ping_group_range` sysctl.
- Dates and daily bandwidth use `TZ` (default `America/Havana`).
- The API applies migrations on startup and runs with a single worker, so the check job runs once.
- Containers restart automatically, have health checks and rotate their logs (3 × 10 MB).

### Slow or unstable connections

Dependency downloads retry instead of failing on a dropped connection:

- **pnpm** (locally and in the web image): settings in `pnpm-workspace.yaml`.
- **uv** (API image): `UV_HTTP_RETRIES=8`, `UV_HTTP_TIMEOUT=300` and 4 parallel downloads.
- **npm** (`fast-test-cli` in the API image): 8 retries with backoff from 20 s up to 3 min, a 5 min request timeout and at most 4 connections.
- Every image build keeps its download cache (pnpm store, uv cache, npm cache) between builds, so a build that fails halfway does not download everything again.

# Log-based Observability

A proof-of-concept demonstrating how meaningful observability signals can be extracted from structured logs.

## Architecture

![Architecture](assests/architecture.svg)

Traffic flows from the k6 load generator through Nginx to Bun HTTP servers. Servers emit structured JSON logs that Vector ingests, and forwards to PostgreSQL for storage and analytics. Grafana provides dashboards for visualization.

## Quick Start

Clone the repo

```bash
git clone https://github.com/HayesBarber/structured-logs-observability.git
cd structured-logs-observability
```
Start the services

```bash
docker compose up -d
```

Once running, generate load with k6

```bash
k6 run ./k6/load.js
```

You can specify a max TPS

```bash
k6 run -e K6_MAX_TPS=500 ./k6/load.js
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| API     | 3001 | Nginx load-balanced Bun HTTP servers |
| Grafana | 3000 | Dashboards and log analytics |

## Endpoints

- `GET /health` — Health check
- `GET /items/:id` — Simulated read path with variable latency
- `POST /items` — Simulated write path with validation
- `GET /fanout` — Simulated downstream service calls

## Grafana

Open http://localhost:3000, create a PostgreSQL datasource with name `grafana-postgresql-datasource`, and import the `./grafana/dashboard.json` dashboard to see:

- Requests per second (TPS)
- Error rates
- P95 latency
- Requests by route

![Dashboard](assests/dashboard.png)

## Tech Stack

- **Bun** — HTTP server runtime
- **Vector** — Log processing
- **PostgreSQL** — Log storage
- **Nginx** — Load balancing
- **Grafana** — Visualization
- **k6** — Load testing

## License

MIT


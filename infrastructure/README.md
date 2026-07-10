# Local Infrastructure

`infrastructure/` contains local-only services for developing clients and service integrations. These services are intentionally broad: a client may only need a subset, but the repo keeps common infrastructure available for analytics, logging, email, monitoring, storage, search, authentication, feature flags, cache, and database work.

This folder is not a workspace package and is never published.

## Requirements

- Docker with Compose support.
- [`mkcert`](https://github.com/FiloSottile/mkcert) for local HTTPS certificates.
- Local DNS or hosts entries that resolve `aiassistant.test` and `*.aiassistant.test` to `127.0.0.1`.

## Local DNS

The infrastructure uses hostnames like `database.aiassistant.test`, `mail.aiassistant.test`, and `monitoring.aiassistant.test`. Those names must resolve to `127.0.0.1` on your machine before the Nginx proxy can serve them.

### Option 1: dnsmasq on macOS

Use dnsmasq when you want wildcard support for every `*.aiassistant.test` service.

```bash
brew install dnsmasq

echo 'address=/aiassistant.test/127.0.0.1' >> "$(brew --prefix)/etc/dnsmasq.conf"

sudo mkdir -p /etc/resolver
printf 'nameserver 127.0.0.1\n' | sudo tee /etc/resolver/aiassistant.test

sudo brew services start dnsmasq
```

Verify resolution:

```bash
scutil --dns | grep aiassistant.test
ping -c 1 database.aiassistant.test
```

If you already have dnsmasq running, restart it instead:

```bash
sudo brew services restart dnsmasq
```

### Option 2: hosts file

Use `/etc/hosts` if you only need a few fixed names. Hosts files do not support wildcard subdomains, so each service hostname must be listed explicitly.

```text
127.0.0.1 aiassistant.test
127.0.0.1 database.aiassistant.test
127.0.0.1 cache.aiassistant.test
127.0.0.1 mail.aiassistant.test
127.0.0.1 monitoring.aiassistant.test
127.0.0.1 prometheus.aiassistant.test
127.0.0.1 storage.aiassistant.test
127.0.0.1 filesystem.aiassistant.test
127.0.0.1 analytics.aiassistant.test
127.0.0.1 search.aiassistant.test
127.0.0.1 auth.aiassistant.test
127.0.0.1 flags.aiassistant.test
127.0.0.1 logger.aiassistant.test
```

## Commands

Root package scripts orchestrate Docker Compose using the files listed in `.services`.

```bash
pnpm infra:certificates  # generate local HTTPS certs for aiassistant.test
pnpm infra:start         # start local infrastructure
pnpm infra:build         # rebuild and start local infrastructure
pnpm infra:stop          # stop local infrastructure
```

The generated certificate is used by the local Nginx reverse proxy for `aiassistant.test` and `*.aiassistant.test`.

## Composition Model

- `.services` is the source of truth for which Compose files participate in `infra:*` commands.
- The root `docker-compose.yml` starts the Nginx reverse proxy.
- The root `Dockerfile` copies `infrastructure/nginx/etc` and each `infrastructure/*/*.conf` file into the Nginx image.
- Each service folder owns its `docker-compose.yml`, Nginx site config, and ignored persistent data directories.

## Service Catalog

| Service         | Tool          | Local URL / port                                          | Notes                                                                                         |
| --------------- | ------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Reverse proxy   | Nginx         | `https://*.aiassistant.test`, ports `80`/`443`            | Routes browser-facing tools through local TLS.                                                |
| Database        | PostgreSQL    | `localhost:5432`                                          | Main local relational database.                                                               |
| Database UI     | pgAdmin       | `https://database.aiassistant.test`, port `5050`          | Default login: `admin@aiassistant.test` / `winnipeg123`.                                      |
| Cache           | Redis         | `localhost:6379`                                          | Default password: `winnipeg123`.                                                              |
| Cache UI        | RedisInsight  | `https://cache.aiassistant.test`, port `5540`             | Browser UI for Redis.                                                                         |
| Mail            | MailHog       | SMTP `localhost:1025`, UI `https://mail.aiassistant.test` | Captures local email instead of sending it.                                                   |
| Monitoring      | Grafana       | `https://monitoring.aiassistant.test`, port `3000`        | Default login: `admin` / `winnipeg123`.                                                       |
| Metrics         | Prometheus    | `https://prometheus.aiassistant.test`, port `9090`        | Uses `infrastructure/monitoring/src/prometheus.yml`.                                          |
| Storage         | MinIO API     | `https://storage.aiassistant.test`, port `9000`           | Default root user: `admin` / `winnipeg123`.                                                   |
| Storage console | MinIO console | `https://filesystem.aiassistant.test`, port `9001`        | Initializes an `app-files` bucket.                                                            |
| Analytics       | Umami         | `https://analytics.aiassistant.test`, port `3001`         | Default login: `admin` / `winnipeg123`; backed by PostgreSQL.                                 |
| Search          | Meilisearch   | `https://search.aiassistant.test`, port `7700`            | Default master key: `winnipeg123`; derived API keys live in `.env.infra`.                     |
| Auth            | Keycloak      | `https://auth.aiassistant.test`, port `8080`              | Default admin: `admin` / `winnipeg123`; local Google simulation uses the `aiassistant` realm. |
| Feature flags   | Unleash       | `https://flags.aiassistant.test`, port `4242`             | Default login: `admin` / `winnipeg123`; local SDK tokens live in `.env.infra`.                |
| Logging         | GlitchTip     | `https://logger.aiassistant.test`, port `8000`            | Error reporting and event logging; DSN lives in `.env.infra`; email goes through MailHog.     |

## Local Environment

`.env.infra` contains local application-facing connection details for the services above. It is local development configuration and can include generated IDs, DSNs, and API tokens from persisted service data, such as:

- `ANALYTICS_WEBSITE_ID` from Umami.
- `AUTH_GOOGLE_ISSUER`, `AUTH_GOOGLE_CLIENT_ID`, and `AUTH_GOOGLE_CLIENT_SECRET` for the local Keycloak Google-provider simulation.
- `FLAGS_BACKEND_TOKEN` and `FLAGS_FRONTEND_TOKEN` from Unleash.
- `SEARCH_ADMIN_KEY` and `SEARCH_SEARCH_KEY` from Meilisearch.
- `LOGGER_DSN` and `LOGGER_SECURITY_ENDPOINT` from GlitchTip.

If you reset a service's persistent data directory, regenerate any corresponding values in `.env.infra`.

## Local Credentials

Credentials in Compose files and `.env.infra` are local development defaults only. Do not reuse them in deployed environments and do not add production secrets to this folder.

## Persistent Data

Service data directories are ignored by git, for example:

- `infrastructure/database/data/`
- `infrastructure/cache/data/`
- `infrastructure/storage/data/`
- `infrastructure/monitoring/grafana/`
- `infrastructure/monitoring/prometheus/`

To reset a service, stop infrastructure and remove that service's local data directory.

## Adding or Removing Services

When changing local infrastructure:

1. Update or add the service's `infrastructure/<service>/docker-compose.yml`.
2. Add any Nginx route as `infrastructure/<service>/<service>.conf` when the service has a browser UI or HTTP API.
3. Update `.services` so root `infra:*` commands include the intended Compose files.
4. Update this README and the root `README.md` if the service changes the developer workflow.
5. Keep generated data and uploads ignored by git.

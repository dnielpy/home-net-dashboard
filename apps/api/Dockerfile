FROM ghcr.io/astral-sh/uv:0.13.6 AS uv

# fast.com speed tests run through the fast-test-cli package, which needs Node
FROM node:24-bookworm-slim AS fast
RUN npm install --global fast-test-cli@1.0.1 \
    --fetch-retries=8 \
    --fetch-retry-factor=2 \
    --fetch-retry-mintimeout=20000 \
    --fetch-retry-maxtimeout=180000 \
    --fetch-timeout=300000

FROM python:3.12-slim-bookworm AS build
COPY --from=uv /uv /bin/uv
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_HTTP_TIMEOUT=300 \
    UV_HTTP_RETRIES=8 \
    UV_CONCURRENT_DOWNLOADS=4
WORKDIR /app
COPY pyproject.toml uv.lock .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project
COPY alembic.ini docker-entrypoint.sh ./
COPY migrations migrations
COPY app app

FROM python:3.12-slim-bookworm
ENV PATH=/app/.venv/bin:$PATH \
    PYTHONUNBUFFERED=1
COPY --from=fast /usr/local/bin/node /usr/local/bin/node
COPY --from=fast /usr/local/lib/node_modules/fast-test-cli /usr/local/lib/node_modules/fast-test-cli
RUN ln -s ../lib/node_modules/fast-test-cli/dist/src/cli.js /usr/local/bin/fast \
    && useradd --system --uid 10001 --no-create-home app
WORKDIR /app
COPY --from=build --chown=app:app /app /app
USER app
EXPOSE 3011
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD ["python", "-c", "import sys, urllib.request; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:3011/health', timeout=4).status == 200 else 1)"]
ENTRYPOINT ["./docker-entrypoint.sh"]

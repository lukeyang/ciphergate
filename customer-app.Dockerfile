FROM node:20-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY next.config.mjs tsconfig.json next-env.d.ts ./
COPY src ./src
COPY scripts ./scripts
COPY prompts ./prompts
COPY customer-gateway ./customer-gateway
COPY policy-server/keys ./policy-server/keys

RUN npm run build

FROM node:20-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PYTHON_BIN=/opt/venv/bin/python
ENV PATH="/opt/venv/bin:${PATH}"

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY policy-server/requirements.txt ./policy-server/requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir -r policy-server/requirements.txt

COPY --from=build /app/.next ./.next
COPY --from=build /app/next.config.mjs ./next.config.mjs
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/prompts ./prompts
COPY --from=build /app/customer-gateway ./customer-gateway
COPY --from=build /app/policy-server/keys ./policy-server/keys

EXPOSE 8080

CMD ["sh", "-c", "npm start -- -p ${PORT:-8080}"]

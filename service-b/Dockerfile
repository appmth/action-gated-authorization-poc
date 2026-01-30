# Get OPA binary (use latest for multi-arch support)
FROM openpolicyagent/opa:latest-static AS opa-binary

# Use debian-slim to have envsubst support
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y gettext-base curl && rm -rf /var/lib/apt/lists/*

COPY --from=opa-binary /opa /usr/local/bin/opa
COPY policy /policy
COPY config.yaml.template /etc/opa/config.yaml.template
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Default env vars
ENV ENVIRONMENT=dev
ENV OPA_LOG_LEVEL=info
ENV OPA_LOG_FORMAT=json

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

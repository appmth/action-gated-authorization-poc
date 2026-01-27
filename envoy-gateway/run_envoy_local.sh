#!/bin/bash
docker build -t envoy-gateway:local .
docker run --rm -p 10000:8080 \
  -e SERVICE_A_HOST=host.docker.internal \
  -e SERVICE_A_PORT=8081 \
  -e SERVICE_C_HOST=host.docker.internal \
  -e SERVICE_C_PORT=8080 \
  -e JWKS_URI=http://host.docker.internal:8081/.well-known/jwks.json \
  -e UPSTREAM_TLS_SERVICE_A="" \
  -e UPSTREAM_TLS_SERVICE_C="" \
  envoy-gateway:local

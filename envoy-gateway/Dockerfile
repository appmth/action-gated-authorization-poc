FROM envoyproxy/envoy:v1.28-latest

RUN apt-get update && apt-get install -y gettext-base && rm -rf /var/lib/apt/lists/*

COPY envoy.yaml.template /etc/envoy/envoy.yaml.template

EXPOSE 8080

CMD ["/bin/sh", "-c", "envsubst < /etc/envoy/envoy.yaml.template > /tmp/envoy.yaml && envoy -c /tmp/envoy.yaml --log-level info"]

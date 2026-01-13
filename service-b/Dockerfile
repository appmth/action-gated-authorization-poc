FROM openpolicyagent/opa:0.60.0

COPY policy /policy

# Cloud Run の PORT 環境変数に合わせる（デフォルト8080）
EXPOSE 8080

# OPA を起動（Cloud Run は PORT=8080 を渡すが、以前の設定で8181の可能性あり）
CMD ["run", "--server", "--addr=0.0.0.0:8080", "/policy"]

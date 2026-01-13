import json
import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel


def log_event(phase: str, request_id: str, action: str, context: dict):
    """構造化ログを JSON で stdout に出力"""
    log = {
        "request_id": request_id,
        "phase": phase,
        "action": action,
        "context": context,
    }
    print(json.dumps(log, ensure_ascii=False))


class ExecuteRequest(BaseModel):
    request_id: str
    action: str
    context: dict


app = FastAPI()


@app.get("/")
def hello():
    return {"message": "service-c (Tool)"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/execute")
def execute(request: ExecuteRequest):
    """Tool 実行エンドポイント"""
    # ログ出力
    log_event(
        phase="tool_executed",
        request_id=request.request_id,
        action=request.action,
        context=request.context,
    )

    return {
        "status": "done",
        "request_id": request.request_id,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

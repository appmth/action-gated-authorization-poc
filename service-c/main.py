import json
import os
import uvicorn
from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# API キー検証用（Envoy Gateway が注入する）
TOOL_API_KEY = os.getenv("TOOL_API_KEY", "")


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


@app.middleware("http")
async def verify_api_key(request: Request, call_next):
    """API キー検証ミドルウェア"""
    # ヘルスチェックはスキップ
    if request.url.path == "/health":
        return await call_next(request)
    
    # キー未設定時はスキップ（開発用）
    if not TOOL_API_KEY:
        return await call_next(request)
    
    # ヘッダから API キーを取得して検証
    api_key = request.headers.get("X-Tool-Api-Key", "")
    if api_key != TOOL_API_KEY:
        return JSONResponse(
            status_code=401,
            content={"detail": "Invalid or missing API key"}
        )
    
    return await call_next(request)


@app.get("/")
def hello():
    return {"message": "service-c (Tool)"}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/execute")
def execute(request: ExecuteRequest):
    """Tool 実行エンドポイント (Legacy)"""
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


@app.post("/resident-info")
def resident_info(request: ExecuteRequest):
    """住民情報取得エンドポイント"""
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
        "data": {
            "resident_id": "R-0001",
            "name": "Taro Yamada",
            "address": "Tokyo",
            "note": "dummy"
        }
    }



if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

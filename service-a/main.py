import hashlib
import json
import os
import time
import uuid
from collections import deque
from datetime import datetime

import google.auth
import google.auth.transport.requests
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


def log_event(
    phase: str,
    request_id: str,
    action: str | None = None,
    context: dict | None = None,
    decision: dict | None = None,
    latency_ms: float | None = None,
    reason: str | None = None,
    tool: dict | None = None,
    idempotency_key: str | None = None,
    outcome: str | None = None,
    error_type: str | None = None,
):
    """構造化ログを JSON で stdout に出力（改修版仕様）"""
    log = {
        "phase": phase,
        "request_id": request_id,
    }
    if action is not None:
        log["action"] = action
    if context is not None:
        log["context"] = context
    if decision is not None:
        log["decision"] = decision
    if latency_ms is not None:
        log["latency_ms"] = round(latency_ms, 2)
    if reason is not None:
        log["reason"] = reason
    if tool is not None:
        log["tool"] = tool
    if idempotency_key is not None:
        log["idempotency_key"] = idempotency_key
    if outcome is not None:
        log["outcome"] = outcome
    if error_type is not None:
        log["error_type"] = error_type
    print(json.dumps(log, ensure_ascii=False))


def generate_idempotency_key(request_id: str, action: str) -> str:
    """idempotency key を生成（二重実行防止用）"""
    return hashlib.sha256(f"{request_id}:{action}".encode()).hexdigest()[:32]

# PDP_URL はベースURLのみ（パスはコード側で付与）
PDP_BASE_URL = os.getenv("PDP_URL", "http://localhost:8181")
PDP_DECISION_PATH = "/v1/data/authorization/decision"

# Tool (service-c) URL
TOOL_URL = os.getenv("TOOL_URL", "http://localhost:8082")

# Vertex AI settings
VERTEX_PROJECT = os.getenv("VERTEX_PROJECT", "")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "asia-northeast1")
VERTEX_MODEL = os.getenv("VERTEX_MODEL", "gemini-2.0-flash")

# Allowed action / context keys for validation
ALLOWED_ACTIONS = {"get_resident_info"}
ALLOWED_CONTEXT_KEYS = {"purpose", "time", "data_sensitivity"}


class Context(BaseModel):
    purpose: str
    time: str
    data_sensitivity: str


class ActionRequest(BaseModel):
    context: Context


class PDPResponse(BaseModel):
    allow: bool
    reason: str


app = FastAPI()

# CORS 設定（judgment-ui からのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# インメモリストア（最新100件を保持）
judgment_store: deque[dict] = deque(maxlen=100)


def store_judgment(
    request_id: str,
    action: str,
    context: dict,
    decision: dict,
    pep_enforcement: dict,
    tool_result: dict | None = None,
    trace: list[dict] | None = None,
):
    """Judgment をインメモリに保存"""
    judgment = {
        "request_id": request_id,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "action": action,
        "context": context,
        "decision": decision,
        "reason_short": decision.get("reason", "")[:80],
        "policy_version": "1.0.0",  # PoC では固定
        "pep_enforcement": pep_enforcement,
        "tool_result": tool_result,
        "trace": trace or [],
    }
    judgment_store.appendleft(judgment)
    return judgment


class PDPError(Exception):
    """PDP 障害時に発生する例外（Fail Closed 用）"""
    pass


class ToolError(Exception):
    """Tool 呼び出し失敗時に発生する例外"""
    pass


class VertexAIError(Exception):
    """Vertex AI 呼び出し失敗時に発生する例外"""
    pass


class PlanRequest(BaseModel):
    request: str


class PlannedAction(BaseModel):
    action: str
    context: dict


class Plan(BaseModel):
    actions: list[PlannedAction]


class ToolResult:
    """Tool 呼び出し結果"""
    def __init__(
        self,
        status_code: int,
        latency_ms: float,
        endpoint: str,
        method: str = "POST",
        data: dict | None = None,
        error_type: str | None = None,
    ):
        self.status_code = status_code
        self.latency_ms = latency_ms
        self.endpoint = endpoint
        self.method = method
        self.data = data
        self.error_type = error_type
        self.ok = 200 <= status_code < 300 and error_type is None


async def call_tool(
    request_id: str,
    action: str,
    context: dict,
    idempotency_key: str,
) -> ToolResult:
    """Tool (外部SaaS) を呼び出す"""
    payload = {
        "request_id": request_id,
        "action": action,
        "context": context,
    }
    endpoint = f"{TOOL_URL}/execute"
    method = "POST"
    headers = {
        "X-Request-Id": request_id,
        "Idempotency-Key": idempotency_key,
    }
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                endpoint,
                json=payload,
                headers=headers,
                timeout=3.0,
            )
            latency_ms = (time.perf_counter() - start) * 1000
            if resp.status_code >= 400:
                return ToolResult(
                    resp.status_code, latency_ms, endpoint, method,
                    error_type=f"http_{resp.status_code}",
                )
            return ToolResult(
                resp.status_code, latency_ms, endpoint, method,
                data=resp.json(),
            )
    except httpx.TimeoutException:
        latency_ms = (time.perf_counter() - start) * 1000
        return ToolResult(0, latency_ms, endpoint, method, error_type="timeout")
    except Exception as e:
        latency_ms = (time.perf_counter() - start) * 1000
        return ToolResult(0, latency_ms, endpoint, method, error_type="connection_error")


def get_access_token() -> str:
    """ADCからアクセストークンを取得"""
    credentials, _ = google.auth.default()
    auth_req = google.auth.transport.requests.Request()
    credentials.refresh(auth_req)
    return credentials.token


def build_vertex_prompt(user_request: str) -> str:
    """Plan生成用のプロンプトを構築"""
    return f"""あなたはリクエストを分析し、実行すべきアクションを計画するAIです。

以下のJSON形式で必ず出力してください。JSON以外は一切出力しないでください。

スキーマ:
{{
  "actions": [
    {{
      "action": "アクション名",
      "context": {{
        "purpose": "目的（inquiry/emergency/audit等）",
        "time": "時間帯（business_hours/after_hours）",
        "data_sensitivity": "データ機密度（required/optional）"
      }}
    }}
  ]
}}

ルール:
1. 利用可能なアクションは「get_resident_info」のみ
2. contextのキーは「purpose」「time」「data_sensitivity」のみ使用可能
3. 不明な情報は推測しない。明確に判断できない場合はactions配列を空にする
4. 実行できそうにない要求の場合もactions配列を空にする

ユーザーのリクエスト:
{user_request}

JSONのみを出力:"""


async def call_vertex_ai(prompt: str) -> dict:
    """Vertex AI (Gemini) をREST APIで呼び出す"""
    if not VERTEX_PROJECT:
        raise VertexAIError("VERTEX_PROJECT is not configured")

    url = (
        f"https://{VERTEX_LOCATION}-aiplatform.googleapis.com"
        f"/v1/projects/{VERTEX_PROJECT}/locations/{VERTEX_LOCATION}"
        f"/publishers/google/models/{VERTEX_MODEL}:generateContent"
    )
    access_token = get_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
    }
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 1024,
        },
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json=body, headers=headers, timeout=30.0)
        resp.raise_for_status()
        return resp.json()


def extract_plan_text(vertex_response: dict) -> str:
    """Vertex AIのレスポンスからテキストを抽出"""
    try:
        return vertex_response["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError):
        return ""


def validate_plan(plan_text: str) -> list[dict]:
    """Plan JSONをパースし、バリデーションを行う（Fail Closed）"""
    # コードブロックを除去 (```json ... ```)
    text = plan_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:]  # 最初の行（```json）を削除
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]  # 最後の行（```）を削除
        text = "\n".join(lines)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []

    if not isinstance(data, dict):
        return []

    actions = data.get("actions")
    if not isinstance(actions, list):
        return []

    validated_actions = []
    for item in actions:
        if not isinstance(item, dict):
            continue
        action = item.get("action")
        context = item.get("context")

        if action not in ALLOWED_ACTIONS:
            continue
        if not isinstance(context, dict):
            continue
        if not set(context.keys()).issubset(ALLOWED_CONTEXT_KEYS):
            continue

        validated_actions.append({"action": action, "context": context})

    return validated_actions


async def call_pdp(action: str, context: dict) -> PDPResponse:
    """PDP（OPA）を呼び出して認可判断を取得する

    Fail Closed: PDP が落ちた場合は PDPError を発生させる
    """
    payload = {
        "input": {
            "action": action,
            "context": context,
        }
    }
    url = f"{PDP_BASE_URL}{PDP_DECISION_PATH}"
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=2.0)
            resp.raise_for_status()
            result = resp.json().get("result", {})
            return PDPResponse(
                allow=result.get("allow", False),
                reason=result.get("reason", "No reason provided"),
            )
    except httpx.TimeoutException:
        raise PDPError("Denied: policy engine unavailable (timeout)")
    except httpx.HTTPStatusError:
        raise PDPError("Denied: policy engine unavailable (error response)")
    except Exception:
        raise PDPError("Denied: policy engine unavailable")


@app.get("/")
def hello():
    return {"message": "Hello World"}

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/judgments")
def list_judgments(limit: int = 20):
    """Judgment 一覧を取得"""
    items = list(judgment_store)[:limit]
    return [
        {
            "request_id": j["request_id"],
            "action": j["action"],
            "result": "ALLOW" if j["decision"]["allow"] else "DENY",
            "reason_short": j["reason_short"],
            "created_at": j["created_at"],
        }
        for j in items
    ]


@app.get("/judgments/{request_id}")
def get_judgment(request_id: str):
    """Judgment 詳細を取得"""
    for j in judgment_store:
        if j["request_id"] == request_id:
            return j
    raise HTTPException(status_code=404, detail="Judgment not found")


@app.post("/v1/actions/get_resident_info")
async def get_resident_info(request: ActionRequest):
    """
    PEP: Action実行前に必ずPDPで認可判断を行う
    - Allow → ダミー成功レスポンス
    - Deny → 403で即座に拒否
    - PDP障害 → 503 (Fail Closed)
    """
    start_time = time.perf_counter()
    request_id = str(uuid.uuid4())
    action = "get_resident_info"
    context = request.context.model_dump()

    # 1. received: リクエスト受信
    log_event(
        phase="received",
        request_id=request_id,
        action=action,
        context=context,
    )

    # PDP呼び出し（実行前に必ず判断）
    pdp_start = time.perf_counter()
    try:
        decision = await call_pdp(action, context)
        pdp_latency_ms = (time.perf_counter() - pdp_start) * 1000
        decision_dict = {"allow": decision.allow, "reason": decision.reason}

        # 2. policy_check: PDP問い合わせ結果
        log_event(
            phase="policy_check",
            request_id=request_id,
            action=action,
            context=context,
            decision=decision_dict,
            latency_ms=pdp_latency_ms,
        )

    except PDPError as e:
        pdp_latency_ms = (time.perf_counter() - pdp_start) * 1000
        total_latency_ms = (time.perf_counter() - start_time) * 1000
        decision_dict = {"allow": False, "reason": str(e)}

        # 2. policy_check: PDP障害
        log_event(
            phase="policy_check",
            request_id=request_id,
            action=action,
            context=context,
            decision=decision_dict,
            latency_ms=pdp_latency_ms,
        )

        # 3. blocked: PDP障害で拒否
        log_event(
            phase="blocked",
            request_id=request_id,
            reason=str(e),
        )

        raise HTTPException(
            status_code=503,
            detail={
                "request_id": request_id,
                "action": action,
                "allowed": False,
                "reason": str(e),
            },
        )

    # Deny の場合は実行させない
    if not decision.allow:
        # 3. blocked: ポリシーで拒否
        log_event(
            phase="blocked",
            request_id=request_id,
            reason=decision.reason,
        )

        # Judgment を保存（DENY）
        now = datetime.utcnow().isoformat() + "Z"
        store_judgment(
            request_id=request_id,
            action=action,
            context=context,
            decision=decision_dict,
            pep_enforcement={
                "pdp_called": True,
                "tool_called": False,
                "side_effects": "none",
            },
            tool_result=None,
            trace=[
                {"step": "Request Received", "at": now, "status": "completed"},
                {"step": "PDP Consulted", "at": now, "status": "completed", "note": "Policy evaluated"},
                {"step": "Decision: DENY", "at": now, "status": "blocked", "note": decision.reason[:50]},
                {"step": "Tool Execution", "at": now, "status": "skipped", "note": "Not called due to DENY"},
            ],
        )

        raise HTTPException(
            status_code=403,
            detail={
                "request_id": request_id,
                "action": action,
                "allowed": False,
                "reason": decision.reason,
            },
        )

    # Allow の場合: Tool を呼び出す
    tool_endpoint = f"{TOOL_URL}/execute"
    idempotency_key = generate_idempotency_key(request_id, action)

    # tool_call_started: 実行開始ログ
    log_event(
        phase="tool_call_started",
        request_id=request_id,
        tool={
            "endpoint": tool_endpoint,
            "method": "POST",
        },
        idempotency_key=idempotency_key,
    )

    # Tool 呼び出し
    tool_result = await call_tool(request_id, action, context, idempotency_key)
    outcome = "success" if tool_result.ok else "error"

    # tool_call_finished: 実行結果ログ
    tool_finished_log = {
        "endpoint": tool_result.endpoint,
        "status_code": tool_result.status_code,
        "latency_ms": round(tool_result.latency_ms, 2),
    }
    log_kwargs = {
        "phase": "tool_call_finished",
        "request_id": request_id,
        "tool": tool_finished_log,
        "outcome": outcome,
    }
    if tool_result.error_type:
        log_kwargs["error_type"] = tool_result.error_type
    log_event(**log_kwargs)

    # Tool 失敗時は 502
    if not tool_result.ok:
        raise HTTPException(
            status_code=502,
            detail={
                "request_id": request_id,
                "action": action,
                "allowed": True,
                "reason": decision.reason,
                "outcome": outcome,
                "error_type": tool_result.error_type,
            },
        )

    # Judgment を保存（ALLOW）
    now = datetime.utcnow().isoformat() + "Z"
    store_judgment(
        request_id=request_id,
        action=action,
        context=context,
        decision=decision_dict,
        pep_enforcement={
            "pdp_called": True,
            "tool_called": True,
            "side_effects": "none",
        },
        tool_result={
            "status_code": tool_result.status_code,
            "latency_ms": round(tool_result.latency_ms, 2),
        },
        trace=[
            {"step": "Request Received", "at": now, "status": "completed"},
            {"step": "PDP Consulted", "at": now, "status": "completed", "note": "Policy evaluated"},
            {"step": "Decision: ALLOW", "at": now, "status": "completed", "note": decision.reason[:50]},
            {"step": "Tool Execution", "at": now, "status": "completed", "note": "Tool called successfully"},
        ],
    )

    return {
        "request_id": request_id,
        "action": action,
        "allowed": True,
        "reason": decision.reason,
        "outcome": outcome,
        "data": {"resident_info": "dummy data - action was allowed"},
    }


@app.post("/v1/agent/plan-and-act")
async def plan_and_act(request: PlanRequest):
    """
    Agent Plan-and-Act エンドポイント
    1. ユーザーリクエストを受け取る
    2. Vertex AI で Plan を生成
    3. Plan を厳格にバリデーション（Fail Closed）
    4. 各アクションを PDP で判定し、allow なら実行（Strict Mode）
    """
    request_id = str(uuid.uuid4())

    log_event(
        phase="plan_request_received",
        request_id=request_id,
    )

    # Vertex AI で Plan 生成
    try:
        prompt = build_vertex_prompt(request.request)
        vertex_response = await call_vertex_ai(prompt)
        plan_text = extract_plan_text(vertex_response)

        log_event(
            phase="plan_generated",
            request_id=request_id,
            reason=plan_text[:500] if plan_text else "empty",
        )

    except VertexAIError as e:
        error_message = str(e)[:200]
        log_event(
            phase="plan_failed",
            request_id=request_id,
            error_type="vertex_ai_config_error",
            reason=error_message,
        )
        # Fail Closed: actions=[] として返す
        return {
            "request_id": request_id,
            "plan": {"actions_count": 0},
            "per_action_results": [],
            "final_status": "blocked",
            "error": {
                "type": "plan_generation_failed",
                "message": "Vertex AI configuration error"
            }
        }
    except httpx.HTTPStatusError as e:
        error_body = e.response.text[:500] if e.response else "no body"
        error_message = f"{e.response.status_code}: {error_body[:100]}"
        log_event(
            phase="plan_failed",
            request_id=request_id,
            error_type="vertex_ai_http_error",
            reason=error_message,
        )
        # Fail Closed: actions=[] として返す
        return {
            "request_id": request_id,
            "plan": {"actions_count": 0},
            "per_action_results": [],
            "final_status": "blocked",
            "error": {
                "type": "plan_generation_failed",
                "message": f"Vertex AI error: {e.response.status_code}"
            }
        }
    except Exception as e:
        error_message = str(e)[:200]
        log_event(
            phase="plan_failed",
            request_id=request_id,
            error_type="vertex_ai_error",
            reason=error_message,
        )
        # Fail Closed: actions=[] として返す
        return {
            "request_id": request_id,
            "plan": {"actions_count": 0},
            "per_action_results": [],
            "final_status": "blocked",
            "error": {
                "type": "plan_generation_failed",
                "message": "Failed to generate plan"
            }
        }

    # Plan バリデーション（Fail Closed）
    validated_actions = validate_plan(plan_text)
    dropped_count = 0  # TODO: 実際にドロップした数をカウント

    log_event(
        phase="plan_validated",
        request_id=request_id,
        context={
            "actions_count": len(validated_actions),
            "dropped_actions_count": dropped_count,
        },
    )

    # validated_actions が空の場合は何もせずに返す
    if not validated_actions:
        return {
            "request_id": request_id,
            "plan": {
                "actions_count": 0,
            },
            "per_action_results": [],
            "final_status": "completed",
        }

    # 各アクションを1つずつ処理（Strict Mode: deny で即終了）
    per_action_results = []
    final_status = "completed"

    for action_item in validated_actions:
        action = action_item["action"]
        context = action_item["context"]

        # PDP に問い合わせ
        pdp_start = time.perf_counter()
        try:
            decision = await call_pdp(action, context)
            pdp_latency_ms = (time.perf_counter() - pdp_start) * 1000
            decision_dict = {"allow": decision.allow, "reason": decision.reason}

            log_event(
                phase="policy_check",
                request_id=request_id,
                action=action,
                context=context,
                decision=decision_dict,
                latency_ms=pdp_latency_ms,
            )

        except PDPError as e:
            pdp_latency_ms = (time.perf_counter() - pdp_start) * 1000
            decision_dict = {"allow": False, "reason": str(e)}

            log_event(
                phase="policy_check",
                request_id=request_id,
                action=action,
                context=context,
                decision=decision_dict,
                latency_ms=pdp_latency_ms,
            )

            # PDP 障害時は blocked として即終了
            log_event(
                phase="blocked",
                request_id=request_id,
                action=action,
                reason=str(e),
            )

            # HTTPException 503 で返す
            raise HTTPException(
                status_code=503,
                detail={
                    "request_id": request_id,
                    "action": action,
                    "allowed": False,
                    "reason": str(e),
                    "message": "Policy engine unavailable"
                },
            )

        # Deny の場合は blocked として即終了（Strict Mode）
        if not decision.allow:
            log_event(
                phase="blocked",
                request_id=request_id,
                action=action,
                reason=decision.reason,
            )

            # Judgment を保存（DENY）
            now = datetime.utcnow().isoformat() + "Z"
            store_judgment(
                request_id=request_id,
                action=action,
                context=context,
                decision=decision_dict,
                pep_enforcement={
                    "pdp_called": True,
                    "tool_called": False,
                    "side_effects": "none",
                },
                tool_result=None,
                trace=[
                    {"step": "Request Received", "at": now, "status": "completed"},
                    {"step": "PDP Consulted", "at": now, "status": "completed", "note": "Policy evaluated"},
                    {"step": "Decision: DENY", "at": now, "status": "blocked", "note": decision.reason[:50]},
                    {"step": "Tool Execution", "at": now, "status": "skipped", "note": "Not called due to DENY"},
                ],
            )

            per_action_results.append({
                "action": action,
                "decision": decision_dict,
                "tool_result": None,
            })
            final_status = "blocked"
            break

        # Allow の場合: Tool 呼び出し
        idempotency_key = generate_idempotency_key(request_id, action)
        tool_endpoint = f"{TOOL_URL}/execute"

        log_event(
            phase="tool_call_started",
            request_id=request_id,
            action=action,
            tool={
                "endpoint": tool_endpoint,
                "method": "POST",
            },
            idempotency_key=idempotency_key,
        )

        # Tool 呼び出し
        tool_result = await call_tool(request_id, action, context, idempotency_key)
        outcome = "success" if tool_result.ok else "error"

        tool_finished_log = {
            "endpoint": tool_result.endpoint,
            "status_code": tool_result.status_code,
            "latency_ms": round(tool_result.latency_ms, 2),
        }
        log_kwargs = {
            "phase": "tool_call_finished",
            "request_id": request_id,
            "action": action,
            "tool": tool_finished_log,
            "outcome": outcome,
        }
        if tool_result.error_type:
            log_kwargs["error_type"] = tool_result.error_type
        log_event(**log_kwargs)

        # Tool 失敗時は 502 で即終了
        if not tool_result.ok:
            raise HTTPException(
                status_code=502,
                detail={
                    "request_id": request_id,
                    "action": action,
                    "allowed": True,  # 重要: decision.allow=true のまま
                    "reason": decision.reason,
                    "outcome": "error",
                    "error_type": tool_result.error_type,
                    "message": f"Tool execution failed: {tool_result.error_type}"
                },
            )

        # Judgment を保存（ALLOW）
        now = datetime.utcnow().isoformat() + "Z"
        store_judgment(
            request_id=request_id,
            action=action,
            context=context,
            decision=decision_dict,
            pep_enforcement={
                "pdp_called": True,
                "tool_called": True,
                "side_effects": "none",
            },
            tool_result={
                "status_code": tool_result.status_code,
                "latency_ms": round(tool_result.latency_ms, 2),
            },
            trace=[
                {"step": "Request Received", "at": now, "status": "completed"},
                {"step": "PDP Consulted", "at": now, "status": "completed", "note": "Policy evaluated"},
                {"step": "Decision: ALLOW", "at": now, "status": "completed", "note": decision.reason[:50]},
                {"step": "Tool Execution", "at": now, "status": "completed", "note": "Tool called successfully"},
            ],
        )

        # 成功時のみ結果を記録
        per_action_results.append({
            "action": action,
            "decision": decision_dict,
            "tool_result": {
                "status_code": tool_result.status_code,
                "latency_ms": round(tool_result.latency_ms, 2),
                "outcome": outcome,
                "error_type": None,
            },
        })

    return {
        "request_id": request_id,
        "plan": {
            "actions_count": len(validated_actions),
        },
        "per_action_results": per_action_results,
        "final_status": final_status,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)

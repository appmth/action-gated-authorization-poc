import asyncio
import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timedelta, timezone
import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.backends import default_backend
import base64
from google.cloud import firestore
import google.auth
import google.auth.transport.requests
import httpx
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


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


def generate_ctx_hash(context: dict) -> str:
    """Context 改ざん防止用ハッシュを生成"""
    ctx_str = json.dumps(context, sort_keys=True)
    return hashlib.sha256(ctx_str.encode()).hexdigest()


def map_action_to_tool_and_action(action: str) -> tuple[str, str]:
    """action を tool と action_mapped に変換する

    Args:
        action: 入力アクション名（例: "get_resident_info"）

    Returns:
        (tool, action_mapped) のタプル
        例: ("resident", "read")
    """
    action_mapping = {
        "get_resident_info": ("resident", "read"),
        "read_resident_record": ("resident", "read_full"),
        "update_benefit_status": ("benefit", "update"),
        "send_official_notice": ("notify", "send"),
    }
    return action_mapping.get(action, (action, action))

# PDP_URL はベースURLのみ（パスはコード側で付与）
PDP_BASE_URL = os.getenv("PDP_URL", "http://localhost:8181")
PDP_DECISION_PATH = "/v1/data/authorization/decision"

# Tool (service-c) URL (直接呼び出し用、レガシー)
TOOL_URL = os.getenv("TOOL_URL", "http://localhost:8082")

# Envoy Gateway URL (構造的強制力)
ENVOY_URL = os.getenv("ENVOY_URL", "http://localhost:10000")

# Vertex AI settings
VERTEX_PROJECT = os.getenv("VERTEX_PROJECT", "")
VERTEX_LOCATION = os.getenv("VERTEX_LOCATION", "asia-northeast1")
VERTEX_MODEL = os.getenv("VERTEX_MODEL", "gemini-2.0-flash")

# Allowed action / context keys for validation
ALLOWED_ACTIONS = {"get_resident_info", "read_resident_record", "update_benefit_status", "send_official_notice"}
ALLOWED_CONTEXT_KEYS = {"purpose", "time", "data_sensitivity"}


class Context(BaseModel):
    purpose: str
    time: str
    data_sensitivity: str


class AuthorizeRequest(BaseModel):
    agent_id: str
    action: str
    context: Context
    request_id: str | None = Field(default_factory=lambda: str(uuid.uuid4()))
    agent_role: str = Field(default="assistant")


class AuthorizeResponse(BaseModel):
    request_id: str
    decision: str
    reason: str
    execution_handle: str | None = None
    expires_in_seconds: int | None = None


# RSA Key Generation for PoC
PRIVATE_KEY_PATH = "private_key.pem"

def get_or_generate_key():
    if os.path.exists(PRIVATE_KEY_PATH):
        with open(PRIVATE_KEY_PATH, "rb") as f:
            private_key = serialization.load_pem_private_key(
                f.read(), password=None, backend=default_backend()
            )
    else:
        private_key = rsa.generate_private_key(
            public_exponent=65537, key_size=2048, backend=default_backend()
        )
        with open(PRIVATE_KEY_PATH, "wb") as f:
            f.write(
                private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption(),
                )
            )
    return private_key

PRIVATE_KEY = get_or_generate_key()
PUBLIC_KEY = PRIVATE_KEY.public_key()

def get_jwks():
    public_numbers = PUBLIC_KEY.public_numbers()
    
    def to_base64url(val):
        return base64.urlsafe_b64encode(val.to_bytes((val.bit_length() + 7) // 8, 'big')).decode('utf-8').rstrip('=')

    return {
        "keys": [
            {
                "kty": "RSA",
                "alg": "RS256",
                "use": "sig",
                "kid": "judgment-key-1",
                "n": to_base64url(public_numbers.n),
                "e": to_base64url(public_numbers.e),
            }
        ]
    }


class ToolRequest(BaseModel):
    """Tool API に送信するリクエスト情報"""
    method: str = "POST"
    path: str
    body: dict = Field(default_factory=dict)


class ExecuteRequest(BaseModel):
    request_id: str
    execution_handle: str
    tool_request: ToolRequest
    parameters: dict | None = None  # 非推奨、後方互換性のため残す


class ExecuteResponse(BaseModel):
    request_id: str
    status: str
    result: dict | None = None
    reason: str | None = None


# scope と path のマッピング
SCOPE_TO_PATHS = {
    "execute:get_resident_info": ["/resident-info"],
    "execute:read_resident_record": ["/resident-record"],
    "execute:update_benefit_status": ["/benefit-status"],
    "execute:send_official_notice": ["/official-notice"],
}


def validate_path_for_scope(scope: str, path: str) -> bool:
    """scope と path の整合性を検証"""
    allowed_paths = SCOPE_TO_PATHS.get(scope, [])
    if not allowed_paths:
        return False
    return any(path.startswith(p) for p in allowed_paths)
# Firestore Client (Lazy Initialization)
_db = None
_jti_collection = None


def get_firestore_client():
    """Firestore クライアントを遅延初期化で取得"""
    global _db, _jti_collection
    if _db is None:
        # エミュレータ使用時はプロジェクトIDを明示的に指定
        # FIRESTORE_EMULATOR_HOST が設定されている場合、SDK は自動的にエミュレータに接続
        emulator_host = os.getenv("FIRESTORE_EMULATOR_HOST")
        project_id = os.getenv("GOOGLE_CLOUD_PROJECT", "aga-poc")
        
        if emulator_host:
            # エミュレータ使用時: 認証不要、プロジェクトIDを明示的に指定
            from google.auth.credentials import AnonymousCredentials
            _db = firestore.Client(project=project_id, credentials=AnonymousCredentials())
            log_event(phase="firestore_init", request_id="system", reason=f"emulator:{emulator_host}")
        else:
            # 本番: ADC を使用
            _db = firestore.Client(project=project_id)
            log_event(phase="firestore_init", request_id="system", reason="production")
        
        _jti_collection = _db.collection("jti_store")
    return _db, _jti_collection


def register_jti(jti: str, jwt_exp_timestamp: int) -> bool:
    """jtiを登録。既に存在する場合はFalseを返す"""
    db, jti_collection = get_firestore_client()
    doc_ref = jti_collection.document(jti)
    jwt_exp = datetime.fromtimestamp(jwt_exp_timestamp, tz=timezone.utc)

    @firestore.transactional
    def create_if_not_exists(transaction):
        doc = doc_ref.get(transaction=transaction)
        if doc.exists:
            return False  # 既に使用済み

        now = datetime.now(timezone.utc)
        transaction.set(doc_ref, {
            "jti": jti,
            "used_at": now,
            "expired_at": jwt_exp,
            "ttl_at": now + timedelta(minutes=10)
        })
        return True

    transaction = db.transaction()
    return create_if_not_exists(transaction)


JUDGMENT_EVENTS_COLLECTION = "judgment_events"


def write_judgment_to_firestore(
    request_id: str,
    agent_id: str,
    agent_role: str,
    tool: str,
    action: str,
    decision: str,
    reason: str,
    blocked_layer: str = "L1 Judgment",
    execution_status: str | None = None,
    jti: str | None = None,
    context: dict | None = None,
    policy_id: str | None = None,
    policy_tags: list | None = None,
):
    """Write a judgment event document to Firestore.

    This is called in a fire-and-forget manner. Errors are logged but never
    propagated so that the API response is not blocked.
    """
    try:
        db, _ = get_firestore_client()
        now = datetime.now(timezone.utc)
        doc_ref = db.collection(JUDGMENT_EVENTS_COLLECTION).document(request_id)
        doc_ref.set({
            "request_id": request_id,
            "created_at": firestore.SERVER_TIMESTAMP,
            "ttl_at": now + timedelta(hours=72),
            "agent_id": agent_id,
            "agent_role": agent_role,
            "tool": tool,
            "action": action,
            "decision": decision,
            "reason": reason,
            "blocked_layer": blocked_layer,
            "execution_status": execution_status,
            "jti": jti,
            "context": context or {},
            "policy_id": policy_id,
            "policy_tags": policy_tags or [],
        })
    except Exception:
        logger.exception("Failed to write judgment event to Firestore (request_id=%s)", request_id)


def update_judgment_in_firestore(
    request_id: str,
    execution_status: str,
    jti: str | None = None,
):
    """Update an existing judgment_events document with execution result.

    Errors are logged but never propagated.
    """
    try:
        db, _ = get_firestore_client()
        doc_ref = db.collection(JUDGMENT_EVENTS_COLLECTION).document(request_id)
        update_fields: dict = {
            "execution_status": execution_status,
        }
        if jti is not None:
            update_fields["jti"] = jti
        doc_ref.update(update_fields)
    except Exception:
        logger.exception("Failed to update judgment event in Firestore (request_id=%s)", request_id)


def _firestore_fire_and_forget(func, *args, **kwargs):
    """Run a blocking Firestore write in a background thread so the API response is not delayed."""
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, lambda: func(*args, **kwargs))


class ActionRequest(BaseModel):
    context: Context


class PDPResponse(BaseModel):
    allow: bool
    reason: str
    policy_id: str | None = None
    tags: list[str] = []


app = FastAPI()

# CORS 設定（judgment-ui / gov-ui からのアクセスを許可）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # judgment-ui dev server
        "http://localhost:3001",  # gov-ui dev server
        "https://judgment-ui.action-gated.tech",
        "https://gov-ui.action-gated.tech",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Agent インメモリストア
agents: dict[str, dict] = {
    "cs-frontdesk": {
        "id": "cs-frontdesk",
        "name": "cs-frontdesk",
        "display_name": "窓口対応エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "cs-night": {
        "id": "cs-night",
        "name": "cs-night",
        "display_name": "夜間対応エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "benefit-admin": {
        "id": "benefit-admin",
        "name": "benefit-admin",
        "display_name": "給付管理エージェント",
        "role": "Backoffice",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "benefit-assistant": {
        "id": "benefit-assistant",
        "name": "benefit-assistant",
        "display_name": "給付窓口エージェント",
        "role": "Frontdesk",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "audit-bot": {
        "id": "audit-bot",
        "name": "audit-bot",
        "display_name": "監査エージェント",
        "role": "Auditor",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
    "notify-agent": {
        "id": "notify-agent",
        "name": "notify-agent",
        "display_name": "通知エージェント",
        "role": "Notifier",
        "status": "active",
        "last_seen": None,
        "banned_reason": None,
        "banned_at": None,
    },
}


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


async def call_tool_via_envoy(
    request_id: str,
    tool_request: ToolRequest,
    execution_handle: str,
) -> ToolResult:
    """Tool を Envoy Gateway 経由で呼び出す（構造的強制力）"""
    # tool_request.path からエンドポイントを構築
    # path は /resident-info のような形式なので /tool を付与
    endpoint = f"{ENVOY_URL}/tool{tool_request.path}"
    method = tool_request.method.upper()
    headers = {
        "Authorization": f"Bearer {execution_handle}",
        "X-Request-Id": request_id,
        "Content-Type": "application/json",
    }
    start = time.perf_counter()
    try:
        async with httpx.AsyncClient() as client:
            if method == "GET":
                resp = await client.get(
                    endpoint,
                    headers=headers,
                    timeout=10.0,
                )
            else:
                resp = await client.request(
                    method,
                    endpoint,
                    json=tool_request.body,
                    headers=headers,
                    timeout=10.0,
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
                policy_id=result.get("policy_id"),
                tags=result.get("tags", []),
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


@app.get("/.well-known/jwks.json")
def jwks():
    """Envoy が JWT 検証に使用する JWKS を公開"""
    return get_jwks()


@app.post("/authorize", response_model=AuthorizeResponse)
async def authorize(request: AuthorizeRequest):
    """
    1. PDP に認可判定を問い合わせ
    2. allow の場合、execution_handle (JWT) を発行
    """
    request_id = request.request_id or str(uuid.uuid4())
    context_dict = request.context.model_dump()

    log_event(
        phase="AUTHZ_REQUEST",
        request_id=request_id,
        action=request.action,
        context=context_dict,
    )

    # BAN チェック
    if request.agent_role in agents and agents[request.agent_role]["status"] == "banned":
        banned_reason = agents[request.agent_role].get("banned_reason", "unknown")
        decision_dict = {"allow": False, "reason": f"Denied: agent is banned ({banned_reason})"}
        tool_mapped, action_mapped = map_action_to_tool_and_action(request.action)
        _firestore_fire_and_forget(
            write_judgment_to_firestore,
            request_id=request_id,
            agent_id=request.agent_id,
            agent_role=request.agent_role,
            tool=tool_mapped,
            action=action_mapped,
            decision="DENY",
            reason=f"Denied: agent is banned ({banned_reason})",
            context=context_dict,
        )
        return AuthorizeResponse(
            request_id=request_id,
            decision="deny",
            reason=f"Denied: agent is banned ({banned_reason})"
        )

    try:
        decision = await call_pdp(request.action, context_dict)
        
        if decision.allow:
            # JWT Claims
            now = datetime.now(timezone.utc)
            exp = now + timedelta(seconds=60)
            
            payload = {
                "iss": "judgment",
                "aud": "envoy-gateway",
                "sub": request.agent_id,
                "jti": str(uuid.uuid4()),
                "exp": int(exp.timestamp()),
                "iat": int(now.timestamp()),
                "scope": f"execute:{request.action}",
                "req_id": request_id,
                "ctx_hash": generate_ctx_hash(context_dict),
            }
            
            # Sign JWT
            token = jwt.encode(
                payload,
                PRIVATE_KEY,
                algorithm="RS256",
                headers={"kid": "judgment-key-1"}
            )
            
            decision_dict = {
                "allow": True,
                "reason": decision.reason,
                "policy_id": decision.policy_id,
                "tags": decision.tags,
            }
            log_event(
                phase="AUTHZ_DECISION",
                request_id=request_id,
                action=request.action,
                decision=decision_dict,
                reason=decision.reason,
            )

            tool_mapped, action_mapped = map_action_to_tool_and_action(request.action)
            _firestore_fire_and_forget(
                write_judgment_to_firestore,
                request_id=request_id,
                agent_id=request.agent_id,
                agent_role=request.agent_role,
                tool=tool_mapped,
                action=action_mapped,
                decision="ALLOW",
                reason=decision.reason,
                context=context_dict,
                policy_id=decision.policy_id,
                policy_tags=decision.tags,
            )

            return AuthorizeResponse(
                request_id=request_id,
                decision="allow",
                reason=decision.reason,
                execution_handle=token,
                expires_in_seconds=60
            )
        else:
            decision_dict = {
                "allow": False,
                "reason": decision.reason,
                "policy_id": decision.policy_id,
                "tags": decision.tags,
            }
            log_event(
                phase="AUTHZ_DECISION",
                request_id=request_id,
                action=request.action,
                decision=decision_dict,
                reason=decision.reason,
            )

            tool_mapped, action_mapped = map_action_to_tool_and_action(request.action)
            _firestore_fire_and_forget(
                write_judgment_to_firestore,
                request_id=request_id,
                agent_id=request.agent_id,
                agent_role=request.agent_role,
                tool=tool_mapped,
                action=action_mapped,
                decision="DENY",
                reason=decision.reason,
                context=context_dict,
                policy_id=decision.policy_id,
                policy_tags=decision.tags,
            )

            return AuthorizeResponse(
                request_id=request_id,
                decision="deny",
                reason=decision.reason
            )

    except PDPError as e:
        log_event(
            phase="authz_error",
            request_id=request_id,
            reason=str(e),
        )
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/execute", response_model=ExecuteResponse)
async def execute(request: ExecuteRequest):
    """
    1. execution_handle (JWT) を検証
    2. scope と tool_request.path の整合性を検証
    3. jti を Firestore でチェック（二重実行防止）
    4. OK なら Tool にプロキシ
    """
    try:
        # JWT 検証（署名、期限）
        # 注意: PoC なので自前の PUBLIC_KEY で検証
        decoded = jwt.decode(
            request.execution_handle,
            PUBLIC_KEY,
            algorithms=["RS256"],
            audience="envoy-gateway"
        )
        
        jti = decoded.get("jti")
        exp_ts = decoded.get("exp")
        request_id = decoded.get("req_id") or request.request_id
        scope = decoded.get("scope", "")
        
        # scope と path の整合性を検証
        if not validate_path_for_scope(scope, request.tool_request.path):
            log_event(
                phase="EXEC_RESULT",
                request_id=request_id,
                reason=f"path not allowed for scope: {scope} -> {request.tool_request.path}",
                outcome="blocked",
            )
            return ExecuteResponse(
                request_id=request_id,
                status="blocked",
                reason=f"path not allowed for scope"
            )

        # Firestore で jti チェック（one-time）
        if not register_jti(jti, exp_ts):
            log_event(
                phase="EXEC_RESULT",
                request_id=request_id,
                reason="execution_handle already used",
                outcome="blocked",
            )
            return ExecuteResponse(
                request_id=request_id,
                status="blocked",
                reason="already used"
            )

        # アクション名を scope から取得（ログ用）
        action = scope.replace("execute:", "") if scope.startswith("execute:") else "unknown"

        log_event(
            phase="EXEC_REQUEST",
            request_id=request_id,
            action=action,
            context={"path": request.tool_request.path, "method": request.tool_request.method},
        )

        # Tool 実行（Envoy 経由）
        tool_result = await call_tool_via_envoy(
            request_id=request_id,
            tool_request=request.tool_request,
            execution_handle=request.execution_handle
        )
        
        if tool_result.ok:
            log_event(
                phase="EXEC_RESULT",
                request_id=request_id,
                action=action,
                latency_ms=tool_result.latency_ms,
                outcome="success",
                tool={"endpoint": tool_result.endpoint},
            )
            _firestore_fire_and_forget(
                update_judgment_in_firestore,
                request_id=request_id,
                execution_status="success",
                jti=jti,
            )
            return ExecuteResponse(
                request_id=request_id,
                status="success",
                result=tool_result.data
            )
        else:
            log_event(
                phase="EXEC_RESULT",
                request_id=request_id,
                reason=f"tool error: {tool_result.error_type}",
                outcome="failed",
                error_type=tool_result.error_type,
            )
            _firestore_fire_and_forget(
                update_judgment_in_firestore,
                request_id=request_id,
                execution_status="failed",
                jti=jti,
            )
            return ExecuteResponse(
                request_id=request_id,
                status="failed",
                reason=tool_result.error_type
            )

    except jwt.ExpiredSignatureError:
        return ExecuteResponse(request_id=request.request_id, status="blocked", reason="expired")
    except jwt.InvalidTokenError as e:
        return ExecuteResponse(request_id=request.request_id, status="blocked", reason=f"invalid token: {str(e)}")
    except Exception as e:
        log_event(phase="exec_error", request_id=request.request_id, reason=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/judgments")
def list_judgments(limit: int = 20):
    """Judgment 一覧を取得（Firestore から読み込み）"""
    limit = min(max(limit, 1), 100)
    try:
        db, _ = get_firestore_client()
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        query = collection_ref.order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit)
        docs = list(query.stream())
        return [_firestore_doc_to_judgment_event(doc) for doc in docs]
    except Exception:
        logger.exception("Failed to query judgments from Firestore")
        return []


@app.get("/judgments/{request_id}")
def get_judgment(request_id: str):
    """Judgment 詳細を取得（Firestore から読み込み）"""
    try:
        db, _ = get_firestore_client()
        doc = db.collection(JUDGMENT_EVENTS_COLLECTION).document(request_id).get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Judgment not found")
        return _firestore_doc_to_judgment_event(doc)
    except HTTPException:
        raise
    except Exception:
        logger.exception("Failed to get judgment from Firestore (request_id=%s)", request_id)
        raise HTTPException(status_code=404, detail="Judgment not found")


def _encode_cursor(created_at_str: str, request_id: str) -> str:
    """Encode a pagination cursor as base64."""
    payload = json.dumps({"ts": created_at_str, "id": request_id})
    return base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[str, str]:
    """Decode a pagination cursor. Returns (created_at_str, request_id)."""
    # Restore padding
    padded = cursor + "=" * (-len(cursor) % 4)
    payload = json.loads(base64.urlsafe_b64decode(padded).decode())
    return payload["ts"], payload["id"]


def _firestore_doc_to_judgment_event(doc) -> dict:
    """Convert a Firestore document snapshot to a JudgmentEvent-compatible dict."""
    d = doc.to_dict()
    # created_at may be a Firestore Timestamp or None
    created_at = d.get("created_at")
    if created_at is not None and hasattr(created_at, "isoformat"):
        ts = created_at.isoformat()
    else:
        ts = d.get("ttl_at", datetime.now(timezone.utc)).isoformat() if created_at is None else str(created_at)

    return {
        "id": d.get("request_id", doc.id),
        "ts": ts,
        "agent_id": d.get("agent_id", ""),
        "agent_role": d.get("agent_role", ""),
        "tool": d.get("tool", ""),
        "action": d.get("action", ""),
        "decision": d.get("decision", ""),
        "reason": d.get("reason", ""),
        "policy_id": d.get("policy_id"),
        "policy_tags": d.get("policy_tags", []),
        "context": d.get("context", {}),
        "blocked_layer": d.get("blocked_layer", "L1 Judgment"),
        "execution_status": d.get("execution_status"),
        "jti": d.get("jti"),
    }


@app.get("/activity")
def get_activity(
    limit: int = 50,
    cursor: str | None = None,
    decision: str | None = None,
    agent_id: str | None = None,
    tool: str | None = None,
):
    """Activity log endpoint with cursor-based pagination from Firestore.

    Composite indexes needed in Firestore:
    - judgment_events: created_at DESC (default ordering)
    - judgment_events: agent_id ASC, created_at DESC
    - judgment_events: decision ASC, created_at DESC
    - judgment_events: tool ASC, created_at DESC
    """
    limit = min(max(limit, 1), 200)

    try:
        db, _ = get_firestore_client()
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)

        # Build query with optional filters
        query = collection_ref
        if decision is not None:
            query = query.where("decision", "==", decision)
        if agent_id is not None:
            query = query.where("agent_id", "==", agent_id)
        if tool is not None:
            query = query.where("tool", "==", tool)

        # Order by created_at desc
        query = query.order_by("created_at", direction=firestore.Query.DESCENDING)

        # Apply cursor for pagination (next page only, since ordering is DESC)
        if cursor is not None:
            try:
                cursor_ts, cursor_id = _decode_cursor(cursor)
                # Fetch the cursor document to use as a snapshot
                cursor_doc = collection_ref.document(cursor_id).get()
                if cursor_doc.exists:
                    query = query.start_after(cursor_doc)
            except Exception:
                pass  # Invalid cursor, ignore and return from beginning

        # Fetch limit + 1 to check if there are more results
        docs = list(query.limit(limit + 1).stream())

        has_more = len(docs) > limit
        docs = docs[:limit]

        items = [_firestore_doc_to_judgment_event(doc) for doc in docs]

        next_cursor = None
        if has_more and docs:
            last_doc_dict = docs[-1].to_dict()
            last_created_at = last_doc_dict.get("created_at")
            last_ts_str = last_created_at.isoformat() if last_created_at and hasattr(last_created_at, "isoformat") else ""
            last_id = last_doc_dict.get("request_id", docs[-1].id)
            next_cursor = _encode_cursor(last_ts_str, last_id)

        return {
            "items": items,
            "next_cursor": next_cursor,
            "has_more": has_more,
        }

    except Exception as e:
        logger.exception("Failed to query activity from Firestore")
        return {
            "items": [],
            "next_cursor": None,
            "has_more": False,
        }


@app.get("/metrics/overview")
def get_metrics_overview():
    """Firestore-based metrics overview for the last 24 hours."""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)

        query = collection_ref.where("created_at", ">=", cutoff)
        docs = list(query.stream())

        total_events = len(docs)
        allow_count = 0
        deny_count = 0
        agent_ids = set()

        for doc in docs:
            d = doc.to_dict()
            decision = d.get("decision", "")
            if decision == "ALLOW":
                allow_count += 1
            elif decision == "DENY":
                deny_count += 1
            aid = d.get("agent_id", "")
            if aid:
                agent_ids.add(aid)

        deny_rate = round(deny_count / total_events * 100, 1) if total_events > 0 else 0.0

        return {
            "total_events": total_events,
            "allow_count": allow_count,
            "deny_count": deny_count,
            "deny_rate": deny_rate,
            "active_agents": len(agent_ids),
            "period": "last_24h",
        }
    except Exception:
        logger.exception("Failed to query metrics/overview from Firestore")
        return {
            "total_events": 0,
            "allow_count": 0,
            "deny_count": 0,
            "deny_rate": 0.0,
            "active_agents": 0,
            "period": "last_24h",
        }


@app.get("/metrics/agents")
def get_metrics_agents():
    """Firestore-based per-agent metrics for the last 24 hours."""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)

        query = collection_ref.where("created_at", ">=", cutoff)
        docs = list(query.stream())

        agent_stats: dict[str, dict] = {}
        for doc in docs:
            d = doc.to_dict()
            aid = d.get("agent_id", "unknown")
            if aid not in agent_stats:
                agent_stats[aid] = {"total": 0, "allow_count": 0, "deny_count": 0}
            agent_stats[aid]["total"] += 1
            decision = d.get("decision", "")
            if decision == "ALLOW":
                agent_stats[aid]["allow_count"] += 1
            elif decision == "DENY":
                agent_stats[aid]["deny_count"] += 1

        result = []
        for aid, stats in agent_stats.items():
            deny_rate = round(stats["deny_count"] / stats["total"] * 100, 1) if stats["total"] > 0 else 0.0
            result.append({
                "agent_id": aid,
                "total": stats["total"],
                "allow_count": stats["allow_count"],
                "deny_count": stats["deny_count"],
                "deny_rate": deny_rate,
            })

        return result
    except Exception:
        logger.exception("Failed to query metrics/agents from Firestore")
        return []


@app.get("/metrics/reasons")
def get_metrics_reasons():
    """Firestore-based deny reason breakdown for the last 24 hours."""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)

        query = collection_ref.where("created_at", ">=", cutoff).where("decision", "==", "DENY")
        docs = list(query.stream())

        reason_counts: dict[str, int] = {}
        total_deny = 0
        for doc in docs:
            d = doc.to_dict()
            reason = d.get("reason", "unknown")
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
            total_deny += 1

        result = []
        for reason, count in reason_counts.items():
            pct = round(count / total_deny * 100, 1) if total_deny > 0 else 0.0
            result.append({
                "reason": reason,
                "count": count,
                "pct": pct,
            })

        return result
    except Exception:
        logger.exception("Failed to query metrics/reasons from Firestore")
        return []


@app.get("/metrics/decision-distribution")
def get_decision_distribution():
    """判定結果の分布（ALLOW / DENY のパーセンテージ）を取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        total = len(docs)
        if total == 0:
            return {"allow_pct": 0, "deny_pct": 0, "total_count": 0}

        allow_count = sum(1 for doc in docs if doc.to_dict().get("decision") == "ALLOW")
        allow_pct = round(allow_count / total * 100)
        deny_pct = 100 - allow_pct

        return {"allow_pct": allow_pct, "deny_pct": deny_pct, "total_count": total}
    except Exception:
        logger.exception("Failed to query metrics/decision-distribution from Firestore")
        return {"allow_pct": 0, "deny_pct": 0, "total_count": 0}


@app.get("/metrics/agent-deny-rate")
def get_agent_deny_rate():
    """エージェント別の Deny 率を取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        agent_stats: dict[str, dict] = {}
        for doc in docs:
            d = doc.to_dict()
            agent = d.get("agent_id", "unknown")
            if agent not in agent_stats:
                agent_stats[agent] = {"total": 0, "deny": 0}
            agent_stats[agent]["total"] += 1
            if d.get("decision") == "DENY":
                agent_stats[agent]["deny"] += 1

        result = []
        for agent, stats in agent_stats.items():
            deny_pct = round(stats["deny"] / stats["total"] * 100) if stats["total"] > 0 else 0
            result.append({"agent": agent, "deny_pct": deny_pct})

        return result
    except Exception:
        logger.exception("Failed to query metrics/agent-deny-rate from Firestore")
        return []


@app.get("/metrics/block-reason-breakdown")
def get_block_reason_breakdown():
    """Deny 理由の内訳を取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).where("decision", "==", "DENY").stream())

        total_deny = len(docs)
        if total_deny == 0:
            return []

        reason_stats: dict[str, int] = {}
        for doc in docs:
            d = doc.to_dict()
            reason = d.get("reason", "unknown")[:80]
            reason_stats[reason] = reason_stats.get(reason, 0) + 1

        result = []
        for reason, count in reason_stats.items():
            pct = round(count / total_deny * 100)
            result.append({"reason": reason, "count": count, "pct": pct})

        return result
    except Exception:
        logger.exception("Failed to query metrics/block-reason-breakdown from Firestore")
        return []


@app.get("/metrics/block-layer-breakdown")
def get_block_layer_breakdown():
    """Block レイヤーの内訳を取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        total = len(docs)
        if total == 0:
            return []

        layer_stats: dict[str, int] = {}
        for doc in docs:
            d = doc.to_dict()
            layer = d.get("blocked_layer", "L1 Judgment")
            layer_stats[layer] = layer_stats.get(layer, 0) + 1

        result = []
        for layer, count in layer_stats.items():
            pct = round(count / total * 100)
            result.append({"layer": layer, "count": count, "pct": pct})

        return result
    except Exception:
        logger.exception("Failed to query metrics/block-layer-breakdown from Firestore")
        return []


@app.get("/metrics/tool-risk-profile")
def get_tool_risk_profile():
    """Tool 別のリスクプロファイルを取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        if not docs:
            return []

        tool_stats: dict[str, dict] = {}
        for doc in docs:
            d = doc.to_dict()
            tool = d.get("tool", "unknown")
            if tool not in tool_stats:
                tool_stats[tool] = {"total": 0, "deny_count": 0}
            tool_stats[tool]["total"] += 1
            if d.get("decision") == "DENY":
                tool_stats[tool]["deny_count"] += 1

        result = []
        for tool, stats in tool_stats.items():
            deny_pct = round(stats["deny_count"] / stats["total"] * 100) if stats["total"] > 0 else 0
            result.append({
                "tool": tool,
                "total": stats["total"],
                "deny_count": stats["deny_count"],
                "deny_pct": deny_pct,
            })

        result.sort(key=lambda x: x["deny_pct"], reverse=True)
        return result
    except Exception:
        logger.exception("Failed to query metrics/tool-risk-profile from Firestore")
        return []


@app.get("/metrics/behavior_heatmap")
def get_behavior_heatmap(window: str = "24h", bucket: str = "1h"):
    """Agent behavior heatmap: deny_rate per agent per 1-hour bucket (last 24h)."""
    try:
        db, _ = get_firestore_client()
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        # Generate 24 bucket start timestamps (each 1 hour)
        bucket_starts: list[str] = []
        for i in range(24):
            t = cutoff + timedelta(hours=i)
            bucket_starts.append(t.strftime("%Y-%m-%dT%H:%M:%SZ"))

        # Aggregate per agent per bucket
        agent_data: dict[str, dict] = {}
        five_min_ago = now - timedelta(minutes=5)

        for doc in docs:
            d = doc.to_dict()
            agent_id = d.get("agent_id", "unknown")
            decision = d.get("decision", "")
            created_at = d.get("created_at")

            if agent_id not in agent_data:
                agent_data[agent_id] = {
                    "cells": [{} for _ in range(24)],
                    "total_allow": 0,
                    "total_deny": 0,
                    "last_5m_deny": 0,
                }

            if created_at is not None and hasattr(created_at, "timestamp"):
                ts = created_at.timestamp()
                created_dt = created_at
            else:
                continue

            # Determine bucket index
            elapsed = ts - cutoff.timestamp()
            bucket_idx = int(elapsed // 3600)
            if bucket_idx < 0 or bucket_idx >= 24:
                continue

            cell = agent_data[agent_id]["cells"][bucket_idx]
            if "allow" not in cell:
                cell["allow"] = 0
                cell["deny"] = 0

            if decision == "ALLOW":
                cell["allow"] += 1
                agent_data[agent_id]["total_allow"] += 1
            elif decision == "DENY":
                cell["deny"] += 1
                agent_data[agent_id]["total_deny"] += 1

            # Last 5 min deny count
            if decision == "DENY" and hasattr(created_dt, "timestamp") and created_dt.timestamp() >= five_min_ago.timestamp():
                agent_data[agent_id]["last_5m_deny"] += 1

        # Ensure all registered agents appear in the heatmap
        for agent_id, agent_info in agents.items():
            if agent_id not in agent_data:
                agent_data[agent_id] = {
                    "cells": [{} for _ in range(24)],
                    "total_allow": 0,
                    "total_deny": 0,
                    "last_5m_deny": 0,
                }

        # Build response
        result_agents = []
        for agent_id, data in agent_data.items():
            total_allow = data["total_allow"]
            total_deny = data["total_deny"]
            summary_total = total_allow + total_deny
            summary_deny_rate = round(total_deny / summary_total * 100, 1) if summary_total > 0 else 0.0

            # Get agent info from in-memory store
            agent_info = agents.get(agent_id, {})
            display_name = agent_info.get("display_name", agent_id)
            role = agent_info.get("role", "unknown")
            status = agent_info.get("status", "active")

            # Build cells array
            cells = []
            for cell in data["cells"]:
                if not cell:
                    cells.append(None)
                else:
                    a = cell.get("allow", 0)
                    d_count = cell.get("deny", 0)
                    t = a + d_count
                    dr = round(d_count / t * 100, 1) if t > 0 else 0.0
                    cells.append({"allow": a, "deny": d_count, "deny_rate": dr, "total": t})

            result_agents.append({
                "agent_id": agent_id,
                "display_name": display_name,
                "role": role,
                "status": status,
                "summary_deny_rate": summary_deny_rate,
                "summary_total": summary_total,
                "summary_deny": total_deny,
                "last_5m_deny": data["last_5m_deny"],
                "cells": cells,
            })

        # Sort by deny_rate descending
        result_agents.sort(key=lambda x: x["summary_deny_rate"], reverse=True)

        return {
            "window": window,
            "bucket_size": bucket,
            "bucket_starts": bucket_starts,
            "agents": result_agents,
        }
    except Exception:
        logger.exception("Failed to query metrics/behavior_heatmap from Firestore")
        return {
            "window": window,
            "bucket_size": bucket,
            "bucket_starts": [],
            "agents": [],
        }


@app.get("/metrics/agent-timeline")
def get_agent_timeline():
    """Agent 別の時系列エントリを取得（Firestore、直近24h）"""
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())

        agent_entries: dict[str, list] = {}
        for doc in docs:
            d = doc.to_dict()
            agent = d.get("agent_id", "unknown")
            if agent not in agent_entries:
                agent_entries[agent] = []

            created_at = d.get("created_at")
            if created_at is not None and hasattr(created_at, "isoformat"):
                ts = created_at.isoformat()
            else:
                ts = str(created_at) if created_at else ""

            is_ban = d.get("action") == "ban"
            agent_entries[agent].append({
                "ts": ts,
                "decision": d.get("decision", ""),
                "is_ban": is_ban,
            })

        result = []
        for agent, entries in agent_entries.items():
            result.append({"agent": agent, "entries": entries})

        return result
    except Exception:
        logger.exception("Failed to query metrics/agent-timeline from Firestore")
        return []


class BanRequest(BaseModel):
    reason: str


@app.get("/agents")
def list_agents():
    """Agent 一覧を取得（allow_24h/deny_24h は Firestore から集計）"""
    # Firestore から直近24hの agent_id 別集計を取得
    agent_counts: dict[str, dict] = {}
    try:
        db, _ = get_firestore_client()
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        collection_ref = db.collection(JUDGMENT_EVENTS_COLLECTION)
        docs = list(collection_ref.where("created_at", ">=", cutoff).stream())
        for doc in docs:
            d = doc.to_dict()
            aid = d.get("agent_id", "")
            if not aid:
                continue
            if aid not in agent_counts:
                agent_counts[aid] = {"allow": 0, "deny": 0}
            if d.get("decision") == "ALLOW":
                agent_counts[aid]["allow"] += 1
            elif d.get("decision") == "DENY":
                agent_counts[aid]["deny"] += 1
    except Exception:
        logger.exception("Failed to query agent counts from Firestore")

    result = []
    for agent_id, agent in agents.items():
        counts = agent_counts.get(agent_id, {"allow": 0, "deny": 0})
        result.append({
            **agent,
            "allow_24h": counts["allow"],
            "deny_24h": counts["deny"],
        })
    return result


@app.post("/agents/{agent_id}/ban")
def ban_agent(agent_id: str, request: BanRequest):
    """Agent を BAN する"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agents[agent_id]["status"] == "banned":
        raise HTTPException(status_code=409, detail="Agent already banned")

    now_str = datetime.utcnow().isoformat() + "Z"
    agents[agent_id]["status"] = "banned"
    agents[agent_id]["banned_reason"] = request.reason
    agents[agent_id]["banned_at"] = now_str

    # BAN イベントを Firestore に記録
    ban_request_id = str(uuid.uuid4())
    _firestore_fire_and_forget(
        write_judgment_to_firestore,
        request_id=ban_request_id,
        agent_id=agent_id,
        agent_role=agent_id,
        tool="system",
        action="ban",
        decision="DENY",
        reason=f"Agent banned: {request.reason}",
        blocked_layer="L1 Judgment",
    )

    return {"status": "banned", "agent_id": agent_id, "reason": request.reason}


@app.post("/agents/{agent_id}/unban")
def unban_agent(agent_id: str):
    """Agent の BAN を解除する"""
    if agent_id not in agents:
        raise HTTPException(status_code=404, detail="Agent not found")
    if agents[agent_id]["status"] == "active":
        raise HTTPException(status_code=409, detail="Agent is not banned")

    agents[agent_id]["status"] = "active"
    agents[agent_id]["banned_reason"] = None
    agents[agent_id]["banned_at"] = None

    return {"status": "active", "agent_id": agent_id}


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

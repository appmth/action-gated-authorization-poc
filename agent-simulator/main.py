from fastapi import FastAPI
import uvicorn
import httpx
import random
import json
import uuid
import os
import datetime
import time

app = FastAPI()

SERVICE_A_BASE_URL = os.environ.get("SERVICE_A_BASE_URL", "http://service-a:8080")
PORT = os.environ.get("PORT", "8080")

AGENT_PROFILES = {
    "cs-frontdesk": {
        "agent_id": "cs-frontdesk",
        "agent_role": "cs-frontdesk",
        "display_name": "窓口対応エージェント",
        "actions": [
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 80},
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
            {"action": "read_resident_record", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "cs-night": {
        "agent_id": "cs-night",
        "agent_role": "cs-night",
        "display_name": "夜間対応エージェント",
        "actions": [
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "after_hours", "data_sensitivity": "required"}, "weight": 70},
            {"action": "get_resident_info", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}, "weight": 30},
        ]
    },
    "benefit-admin": {
        "agent_id": "benefit-admin",
        "agent_role": "benefit-admin",
        "display_name": "給付管理エージェント",
        "actions": [
            {"action": "update_benefit_status", "context": {"purpose": "approval", "time": "business_hours", "data_sensitivity": "required"}, "weight": 60},
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 30},
            {"action": "update_benefit_status", "context": {"purpose": "approval", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "benefit-assistant": {
        "agent_id": "benefit-assistant",
        "agent_role": "benefit-assistant",
        "display_name": "給付窓口エージェント",
        "actions": [
            {"action": "update_benefit_status", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 70},
            {"action": "get_resident_info", "context": {"purpose": "inquiry", "time": "business_hours", "data_sensitivity": "required"}, "weight": 30},
        ]
    },
    "audit-bot": {
        "agent_id": "audit-bot",
        "agent_role": "audit-bot",
        "display_name": "監査エージェント",
        "actions": [
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 60},
            {"action": "read_resident_record", "context": {"purpose": "audit", "time": "after_hours", "data_sensitivity": "required"}, "weight": 30},
            {"action": "get_resident_info", "context": {"purpose": "audit", "time": "business_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
    "notify-agent": {
        "agent_id": "notify-agent",
        "agent_role": "notify-agent",
        "display_name": "通知エージェント",
        "actions": [
            {"action": "send_official_notice", "context": {"purpose": "notification", "time": "business_hours", "data_sensitivity": "optional"}, "weight": 70},
            {"action": "send_official_notice", "context": {"purpose": "notification", "time": "after_hours", "data_sensitivity": "optional"}, "weight": 20},
            {"action": "send_official_notice", "context": {"purpose": "emergency", "time": "after_hours", "data_sensitivity": "required"}, "weight": 10},
        ]
    },
}

last_trigger_time = None
total_requests = 0
error_count = 0


def log_event(*, phase, agent_id=None, action=None, decision=None, reason=None, latency_ms=None, error=None):
    entry = {"ts": datetime.datetime.utcnow().isoformat() + "Z", "phase": phase}
    for k, v in {"agent_id": agent_id, "action": action, "decision": decision, "reason": reason, "latency_ms": latency_ms, "error": error}.items():
        if v is not None:
            entry[k] = v
    print(json.dumps(entry, ensure_ascii=False), flush=True)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/trigger")
async def trigger():
    global last_trigger_time, total_requests, error_count

    count = random.randint(1, 3)
    selected_keys = random.choices(list(AGENT_PROFILES.keys()), k=count)
    results = []

    async with httpx.AsyncClient(timeout=5.0) as client:
        for agent_key in selected_keys:
            profile = AGENT_PROFILES[agent_key]
            actions = profile["actions"]
            weights = [a["weight"] for a in actions]
            selected = random.choices(actions, weights=weights, k=1)[0]

            payload = {
                "agent_id": profile["agent_id"],
                "agent_role": profile["agent_role"],
                "action": selected["action"],
                "context": selected["context"],
            }

            log_event(phase="request", agent_id=profile["agent_id"], action=selected["action"])

            start = time.time()
            try:
                resp = await client.post(f"{SERVICE_A_BASE_URL}/authorize", json=payload)
                latency_ms = round((time.time() - start) * 1000)
                resp_data = resp.json()
                decision = resp_data.get("decision", "unknown")
                reason = resp_data.get("reason", "")

                log_event(
                    phase="response",
                    agent_id=profile["agent_id"],
                    action=selected["action"],
                    decision=decision,
                    reason=reason,
                    latency_ms=latency_ms,
                )

                results.append({
                    "agent_id": profile["agent_id"],
                    "action": selected["action"],
                    "decision": decision,
                    "reason": reason,
                    "latency_ms": latency_ms,
                })
            except Exception as e:
                latency_ms = round((time.time() - start) * 1000)
                error_count += 1
                log_event(
                    phase="error",
                    agent_id=profile["agent_id"],
                    action=selected["action"],
                    error=str(e),
                    latency_ms=latency_ms,
                )
                results.append({
                    "agent_id": profile["agent_id"],
                    "action": selected["action"],
                    "decision": "error",
                    "reason": str(e),
                    "latency_ms": latency_ms,
                })

            total_requests += 1

    last_trigger_time = datetime.datetime.utcnow().isoformat() + "Z"
    return {"triggered_count": count, "results": results}


@app.get("/status")
def status():
    return {
        "last_trigger": last_trigger_time,
        "total_requests": total_requests,
        "errors_last_24h": error_count,
    }


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)

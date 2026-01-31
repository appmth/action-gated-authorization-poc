import json
import urllib.request
import urllib.error

API_URL = "https://service-a.action-gated.tech"
# API_URL = "http://localhost:8080"

def post_json(url, data):
    req = urllib.request.Request(
        url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    try:
        with urllib.request.urlopen(req) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        print(f"HTTP Error {e.code}: {e.read().decode()}")
        raise

def test_flow():
    print("--- Step 1: Authorize ---")
    auth_payload = {
        "agent_id": "gov-ui-agent",
        "action": "get_resident_info",
        "context": {
            "purpose": "inquiry",
            "time": "business_hours",
            "data_sensitivity": "required"
        }
    }
    
    try:
        auth_data = post_json(f"{API_URL}/authorize", auth_payload)
        print(json.dumps(auth_data, indent=2))
        
        if auth_data.get("decision") != "allow":
            print("Authorization denied.")
            return

        req_id = auth_data["request_id"]
        handle = auth_data["execution_handle"]

        print("\n--- Step 2: Execute ---")
        item_body = {
            "request_id": req_id,
            "action": "get_resident_info",
            "context": {}
        }
        
        exec_payload = {
            "request_id": req_id,
            "execution_handle": handle,
            "tool_request": {
                "method": "POST",
                "path": "/resident-info",
                "body": item_body
            }
        }
        
        exec_data = post_json(f"{API_URL}/execute", exec_payload)
        print(json.dumps(exec_data, indent=2))
        
        if exec_data.get("status") == "success":
            print("SUCCESS: Execution completed.")
        else:
            print("FAILURE: Execution blocked/failed.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_flow()

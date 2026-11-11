"""Phase 1: app wiring, health, CORS, error shape."""

from __future__ import annotations


def test_health_ok(client):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["llm"] in {"up", "fallback"}


def test_cors_allows_configured_origin(client):
    res = client.options(
        "/api/session/init",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "POST",
        },
    )
    assert res.status_code == 200
    assert res.headers["access-control-allow-origin"] == "http://localhost:3000"


def test_unknown_route_uses_canonical_error_shape(client):
    res = client.get("/api/nope")
    assert res.status_code == 404
    assert set(res.json()["error"]) == {"code", "message"}


def test_validation_error_is_invalid_input(client):
    res = client.post("/api/session/init", json={"candidate_name": ""})
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "invalid_input"


def test_openapi_exposes_the_contract(client):
    schemas = client.get("/openapi.json").json()["components"]["schemas"]
    for name in (
        "HealthResponse",
        "SessionInitRequest",
        "SessionInitResponse",
        "SubmitRequest",
        "SubmitResponse",
        "VerifyRequest",
        "VerifyResponse",
        "IssuerProfile",
    ):
        assert name in schemas
    assert "from" in schemas["BriefInfo"]["properties"]


def test_issuer_profile_is_a_did_key(client):
    body = client.get("/api/issuer").json()
    assert body["id"].startswith("did:key:z6Mk")
    assert body["public_key_multibase"].startswith("z6Mk")
    assert body["verification_method"] == f"{body['id']}#{body['public_key_multibase']}"
    assert body["name"] == "ReconCore"

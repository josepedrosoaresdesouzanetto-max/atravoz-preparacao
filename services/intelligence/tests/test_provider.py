import json

import httpx
import pytest

from intelligence.providers import OllamaProvider


def test_ollama_wire_contract(monkeypatch):
    original_client = httpx.Client

    def handler(request):
        payload = json.loads(request.content)
        assert request.url.path == "/api/chat"
        assert payload["stream"] is False
        assert payload["format"]["additionalProperties"] is False
        assert json.loads(payload["messages"][1]["content"])["untrusted_report"] == "relato de teste"
        assert "tools" not in payload
        return httpx.Response(200, json={"message": {"content": '{"suggested_category":"indeterminado"}'}})

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs)
    )
    assert (
        json.loads(OllamaProvider("test-model").extract("relato de teste"))["suggested_category"]
        == "indeterminado"
    )


@pytest.mark.parametrize("kind", ["timeout", "oversized", "malformed"])
def test_ollama_transport_failures(monkeypatch, kind):
    original_client = httpx.Client

    def handler(request):
        if kind == "timeout":
            raise httpx.ReadTimeout("test timeout")
        return httpx.Response(200, content=b"x" * (70000 if kind == "oversized" else 4))

    monkeypatch.setattr(
        httpx, "Client", lambda **kwargs: original_client(transport=httpx.MockTransport(handler), **kwargs)
    )
    with pytest.raises((ValueError, httpx.ReadTimeout)):
        OllamaProvider("test-model").extract("teste")

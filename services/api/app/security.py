import hashlib
import hmac
import time
from collections import OrderedDict, deque

from fastapi import Header, HTTPException
from starlette.responses import JSONResponse


def key_hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def require_operator(expected: str):
    def dependency(authorization: str = Header(default="")):
        if len(expected) < 32:
            raise HTTPException(
                503, "Central bloqueada: configure OPERATOR_TOKEN com pelo menos 32 caracteres."
            )
        if not hmac.compare_digest(authorization, f"Bearer {expected}"):
            raise HTTPException(401, "Acesso administrativo não autorizado.")
        return "local-demo-operator"

    return dependency


class RequestLimits:
    """Limites antes do parsing; não confia em Content-Length ou IP encaminhado."""

    def __init__(self, app, max_bytes=4 * 1024 * 1024 + 65536, per_minute=120):
        self.app, self.max_bytes, self.per_minute = app, max_bytes, per_minute
        self.clients = OrderedDict()

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        if scope["path"].startswith("/api"):
            key = (scope.get("client") or ("unknown",))[0]
            now = time.monotonic()
            events = self.clients.setdefault(key, deque())
            self.clients.move_to_end(key)
            while events and events[0] < now - 60:
                events.popleft()
            if len(events) >= self.per_minute:
                return await JSONResponse(
                    {"detail": "Muitas requisições. Tente em um minuto."}, 429, headers={"Retry-After": "60"}
                )(scope, receive, send)
            events.append(now)
            if len(self.clients) > 1000:
                self.clients.popitem(last=False)
        if scope["method"] in ("POST", "PUT", "PATCH"):
            data = bytearray()
            while True:
                event = await receive()
                if event["type"] == "http.disconnect":
                    return
                data.extend(event.get("body", b""))
                if len(data) > self.max_bytes:
                    return await JSONResponse({"detail": "Arquivo ou corpo acima do limite."}, 413)(
                        scope, receive, send
                    )
                if not event.get("more_body", False):
                    break
            consumed = False

            async def replay():
                nonlocal consumed
                if not consumed:
                    consumed = True
                    return {"type": "http.request", "body": bytes(data), "more_body": False}
                return await receive()

            await self.app(scope, replay, send)
        else:
            await self.app(scope, receive, send)

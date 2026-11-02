"""One-click local Windows launcher. No firewall rules, public listener or autostart."""

import argparse
import ctypes
import ctypes.wintypes
import json
import os
from pathlib import Path
import secrets
import socket
import sys
import threading
import time
import webbrowser


def protect(data: bytes, decrypt=False):
    if os.name != "nt":
        raise RuntimeError("This launcher uses Windows DPAPI")

    class Blob(ctypes.Structure):
        _fields_ = [("size", ctypes.wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_byte))]

    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_byte)))
    target = Blob()
    function = ctypes.windll.crypt32.CryptUnprotectData if decrypt else ctypes.windll.crypt32.CryptProtectData
    function.argtypes = [
        ctypes.POINTER(Blob),
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.c_void_p,
        ctypes.wintypes.DWORD,
        ctypes.POINTER(Blob),
    ]
    function.restype = ctypes.wintypes.BOOL
    if not function(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise ctypes.WinError()
    try:
        return ctypes.string_at(target.data, target.size)
    finally:
        ctypes.windll.kernel32.LocalFree.argtypes = [ctypes.c_void_p]
        ctypes.windll.kernel32.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def prepare_authority(directory):
    from jwcrypto import jwk

    directory.mkdir(parents=True, exist_ok=True)
    secret = directory / "password.dpapi"
    if secret.exists():
        password = protect(secret.read_bytes(), True)
    else:
        if (directory / "signing.pem").exists() or (directory / "encryption.pem").exists():
            raise RuntimeError("Chaves existentes sem proteção recuperável; preserve os arquivos.")
        password = secrets.token_urlsafe(48).encode()
        with secret.open("xb") as stream:
            stream.write(protect(password))
    for name, parameters in [
        ("signing.pem", {"kty": "EC", "crv": "P-256"}),
        ("encryption.pem", {"kty": "RSA", "size": 3072}),
    ]:
        path = directory / name
        if not path.exists():
            key = jwk.JWK.generate(**parameters)
            with path.open("xb") as stream:
                stream.write(key.export_to_pem(private_key=True, password=password))
    os.environ["MESH_KEY_DIR"] = str(directory)
    os.environ["MESH_KEY_PASSWORD"] = password.decode()


class CentralRuntime:
    def __init__(self, directory):
        import msvcrt

        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True)
        self.lock = (self.directory / "central.lock").open("a+b")
        if self.lock.seek(0, 2) == 0:
            self.lock.write(b"0")
            self.lock.flush()
        self.lock.seek(0)
        try:
            msvcrt.locking(self.lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            self.lock.close()
            raise RuntimeError("Já existe uma central usando esta pasta de dados.") from None
        resource = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parents[1]))
        os.environ["ATRAVOZ_RESOURCE_DIR"] = str(resource)
        os.environ["DATABASE_PATH"] = str(self.directory / "incidents.sqlite3")
        os.environ["OPERATOR_TOKEN"] = secrets.token_hex(32)
        self.token = os.environ["OPERATOR_TOKEN"]
        prepare_authority(self.directory / "mesh-keys")
        sys.path.insert(0, str(resource / "services/api"))
        sys.path.insert(0, str(resource / "services/intelligence/src"))
        from app.main import create_app
        import uvicorn

        self.app = create_app()
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.bind(("127.0.0.1", 0))
        self.socket.listen(128)
        self.port = self.socket.getsockname()[1]
        self.url = f"http://127.0.0.1:{self.port}/central/"
        self.server = uvicorn.Server(
            uvicorn.Config(
                self.app,
                host="127.0.0.1",
                port=self.port,
                access_log=False,
                log_config=None,
                log_level="critical",
            )
        )
        self.thread = threading.Thread(target=self.server.run, kwargs={"sockets": [self.socket]}, daemon=True)
        self.thread.start()
        import httpx

        for _ in range(100):
            if not self.thread.is_alive():
                raise RuntimeError("A API local não iniciou.")
            try:
                if (
                    httpx.get(
                        f"http://127.0.0.1:{self.port}/api/v1/ready", timeout=0.5, trust_env=False
                    ).status_code
                    == 200
                ):
                    return
            except Exception:
                pass
            time.sleep(0.1)
        self.stop()
        raise RuntimeError("Tempo de inicialização excedido.")

    def stop(self):
        self.server.should_exit = True
        self.thread.join(timeout=10)
        self.socket.close()
        self.lock.close()


def self_test(directory):
    import httpx
    from uuid import uuid4
    from datetime import datetime, timezone

    runtime = CentralRuntime(directory)
    try:
        try:
            CentralRuntime(directory)
        except RuntimeError as error:
            assert "Já existe" in str(error)
        else:
            raise AssertionError("Concurrent use of the same database was accepted")
        base = f"http://127.0.0.1:{runtime.port}"
        at = datetime.now(timezone.utc).isoformat()
        iid = str(uuid4())
        headers = {"Authorization": "Bearer " + runtime.token}
        with httpx.Client(base_url=base, trust_env=False) as client:
            assert client.get("/central/").status_code == 200
            assert client.get("/api/v1/incidents").status_code == 401
            body = {
                "incident": {
                    "schema_version": 1,
                    "incident_id": iid,
                    "created_at": at,
                    "updated_at": at,
                    "record_type": "help",
                    "description": "TESTE SINTÉTICO DO INICIADOR WINDOWS",
                    "synthetic": True,
                },
                "write_key": secrets.token_hex(32),
            }
            assert client.post("/api/v1/incidents", json=body).status_code == 200
            assert client.get("/api/v1/incidents/" + iid, headers=headers).status_code == 200
            assert client.get("/api/v1/diagnostics", headers=headers).status_code == 200
            assert client.get("/api/v1/mesh/trust").status_code == 200
        pid = os.getpid()
        port = runtime.port
    finally:
        runtime.stop()
    reopened = CentralRuntime(directory)
    try:
        with httpx.Client(trust_env=False) as client:
            assert (
                client.get(
                    f"http://127.0.0.1:{reopened.port}/api/v1/incidents/" + iid,
                    headers={"Authorization": "Bearer " + reopened.token},
                ).status_code
                == 200
            )
    finally:
        reopened.stop()
    assert not runtime.thread.is_alive() and not reopened.thread.is_alive()
    result = {
        "passed": True,
        "runtime": "packaged-executable" if getattr(sys, "frozen", False) else "source-python",
        "pid": pid,
        "loopback_port": port,
        "authenticated_api": True,
        "persistent_database_after_restart": True,
        "mesh_authority_dpapi": True,
        "diagnostics": True,
        "clean_shutdown": True,
        "public_listener": False,
        "firewall_changed": False,
        "duplicate_instance_rejected": True,
    }
    (Path(directory) / "launcher-self-test.json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    if sys.stdout is not None:
        print(json.dumps(result))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true")
    parser.add_argument("--data-dir")
    args = parser.parse_args()
    directory = args.data_dir or str(
        Path(os.environ.get("LOCALAPPDATA", Path.home())) / "ATRAVOZ" / "Central"
    )
    if args.self_test:
        try:
            self_test(directory)
        except Exception:
            Path(directory).mkdir(parents=True, exist_ok=True)
            (Path(directory) / "launcher-self-test.json").write_text(
                json.dumps({"passed": False, "code": "SELF_TEST_FAILED"}), encoding="utf-8"
            )
            raise SystemExit(1) from None
        return
    import tkinter as tk
    from tkinter import messagebox

    window = tk.Tk()
    window.title("ATRAVOZ Central Desktop")
    window.geometry("610x350")
    window.configure(background="#f4f5ef")
    try:
        runtime = CentralRuntime(directory)
    except Exception as e:
        messagebox.showerror("ATRAVOZ — não iniciou", str(e))
        window.destroy()
        return
    tk.Label(
        window, text="ATRAVOZ · Central Desktop", font=("Segoe UI", 19, "bold"), bg="#f4f5ef", fg="#123e39"
    ).pack(pady=16)
    tk.Label(
        window,
        text="API local ativa. Nenhum socorro é acionado.\nUse dados fictícios nesta demonstração.",
        font=("Segoe UI", 11),
        bg="#f4f5ef",
    ).pack()
    tk.Label(window, text=runtime.url, bg="#f4f5ef").pack(pady=10)
    tk.Button(
        window,
        text="Abrir central no navegador",
        command=lambda: webbrowser.open(runtime.url),
        font=("Segoe UI", 12),
    ).pack(pady=6)

    def copy_token():
        window.clipboard_clear()
        window.clipboard_append(runtime.token)
        messagebox.showinfo(
            "Chave copiada", "Cole no campo Chave do operador. Não compartilhe com voluntários."
        )

    tk.Button(window, text="Copiar chave do operador", command=copy_token).pack(pady=6)
    tk.Label(
        window,
        text="Fechar esta janela encerra somente a API desta instância.\nOs dados permanecem na pasta do usuário. Nenhuma regra de firewall é criada.",
        bg="#f4f5ef",
        wraplength=570,
    ).pack(pady=12)

    def close():
        runtime.stop()
        window.destroy()

    window.protocol("WM_DELETE_WINDOW", close)
    window.mainloop()


if __name__ == "__main__":
    main()

"""Generate local encrypted authority keys; refuses overwriting existing files."""

import os
from pathlib import Path
from jwcrypto import jwk


def main():
    password = os.environ.get("MESH_KEY_PASSWORD", "")
    directory = Path(os.environ.get("MESH_KEY_DIR", "runtime/mesh-keys")).resolve()
    if len(password) < 32:
        raise SystemExit(
            "Defina MESH_KEY_PASSWORD com pelo menos 32 caracteres aleatórios; não salve no Git."
        )
    directory.mkdir(parents=True, exist_ok=True)
    if any((directory / name).exists() for name in ("signing.pem", "encryption.pem")):
        raise SystemExit("Chaves existentes preservadas. Use outro diretório para uma autoridade de teste.")
    keys = [jwk.JWK.generate(kty="EC", crv="P-256"), jwk.JWK.generate(kty="RSA", size=3072)]
    for name, key in zip(("signing.pem", "encryption.pem"), keys, strict=True):
        with (directory / name).open("xb") as stream:
            stream.write(key.export_to_pem(private_key=True, password=password.encode()))
    print("Autoridade criada; ID público:", keys[0].thumbprint())


if __name__ == "__main__":
    main()

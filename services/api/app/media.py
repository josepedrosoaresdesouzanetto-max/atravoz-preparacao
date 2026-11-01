import io
import warnings

from fastapi import HTTPException
from PIL import Image

Image.MAX_IMAGE_PIXELS = 16_000_000


def validate_media(data: bytes, mime: str):
    if mime.startswith("image/"):
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", Image.DecompressionBombWarning)
                with Image.open(io.BytesIO(data)) as picture:
                    expected = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}[mime]
                    if picture.format != expected:
                        raise ValueError("mismatch")
                    picture.verify()
        except Exception as exc:
            raise HTTPException(415, "Imagem inválida ou dimensões excessivas.") from exc
    else:
        valid = (
            (mime == "audio/webm" and data.startswith(b"\x1a\x45\xdf\xa3"))
            or (mime == "audio/ogg" and data.startswith(b"OggS"))
            or (mime == "audio/wav" and data.startswith(b"RIFF") and data[8:12] == b"WAVE")
            or (mime == "audio/mp4" and data[4:8] == b"ftyp")
        )
        if not valid:
            raise HTTPException(415, "Contêiner de áudio inválido.")
        # Header check is not full decoding or antivirus. Synthetic demo only.

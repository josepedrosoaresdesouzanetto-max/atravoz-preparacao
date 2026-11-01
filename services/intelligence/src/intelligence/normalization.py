import unicodedata


def normalize(text: str) -> str:
    """Normaliza uma cópia, sem substituir o relato original."""
    return " ".join(unicodedata.normalize("NFC", text).split())

"""Extração conservadora: evidências literais, sem classificação de prioridade."""

import re
import unicodedata

from intelligence.contracts import ExtractedInformation, ModelOutput
from intelligence.normalization import normalize

NUMBERS = {
    "uma": 1,
    "um": 1,
    "duas": 2,
    "dois": 2,
    "tres": 3,
    "quatro": 4,
    "cinco": 5,
    "seis": 6,
    "sete": 7,
    "oito": 8,
    "nove": 9,
    "dez": 10,
}
PEOPLE = re.compile(r"\b(\d{1,5}|uma?|duas|dois|tres|quatro|cinco|seis|sete|oito|nove|dez)\s+pessoas?\b")
INJECTION = re.compile(
    r"ignore.{0,35}instru|system\s*:|execute.{0,20}comando|apague.{0,20}registro|resgate enviado", re.I
)


def folded(text: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", text.lower()) if not unicodedata.combining(c))


def explicit_people(text: str) -> tuple[int | None, str | None]:
    plain = folded(text)
    matches = list(PEOPLE.finditer(plain))
    values = {int(m[1]) if m[1].isdigit() else NUMBERS[m[1]] for m in matches}
    # Several numbers, negation or uncertainty must not become a definite count.
    uncertain = re.search(r"\b(talvez|acho|parece|ou|nenhuma)\b", plain)
    negated = any(re.search(r"\bnao\b", plain[max(0, m.start() - 18) : m.start()]) for m in matches)
    if len(values) != 1 or uncertain or negated or max(values, default=0) > 10000:
        return None, None
    m = matches[0]
    # NFC Portuguese accents do not alter character positions after folding.
    return next(iter(values)), text[m.start() : m.end()]


def extract_rules(text: str) -> ModelOutput:
    normalized = normalize(text)
    plain = folded(normalized)
    limitations = ["Regras determinísticas; não é inferência de modelo generativo.", "Relato não verificado."]
    if INJECTION.search(plain):
        return ModelOutput(
            limitations=limitations + ["Instruções no relato ignoradas; conteúdo exige revisão."]
        )
    people, evidence = explicit_people(normalized)
    category = "indeterminado"
    category_evidence = None
    rules = [
        ("pessoas_ilhadas", r"ilhad\w*|nao conseguem sair|em cima de uma casa"),
        ("deslizamento", r"deslizamento|barreira caiu"),
        ("incendio", r"incendio|pegando fogo"),
        ("alagamento", r"alag\w*|agua.{0,15}subindo"),
    ]
    if not re.search(r"\b(nao (ha|tem|esta|estao|existe|houve)|sem|talvez)\b", plain):
        for candidate, pattern in rules:
            found = re.search(pattern, plain)
            if found:
                category, category_evidence = candidate, normalized[found.start() : found.end()]
                break
    conditions = []
    match = re.search(r"agua.{0,15}subindo", plain)
    if match and not re.search(r"\b(nao|talvez)\b", plain[max(0, match.start() - 10) : match.end()]):
        conditions.append(normalized[match.start() : match.end()])
    if len(list(PEOPLE.finditer(plain))) > 1:
        limitations.append("Múltiplas quantidades mencionadas; verificar contradição ou grupos distintos.")
    return ModelOutput(
        suggested_category=category,
        extracted_information=ExtractedInformation(
            people_mentioned=people,
            people_evidence=evidence,
            conditions=conditions,
            category_evidence=category_evidence,
        ),
        confidence="low",
        limitations=limitations,
    )


def validate_evidence(output: ModelOutput, original: str) -> None:
    """Rejeita invenções verificáveis; evidência literal não prova a interpretação."""
    normalized = normalize(original)
    info = output.extracted_information
    for quote in [info.people_evidence, info.category_evidence, *info.conditions]:
        if quote is not None and (not quote or quote not in normalized):
            raise ValueError("ungrounded evidence")
    if info.people_mentioned is not None:
        count, _ = explicit_people(normalized)
        if count != info.people_mentioned or not info.people_evidence:
            raise ValueError("ungrounded count")
    if output.suggested_category != "indeterminado" and not info.category_evidence:
        raise ValueError("category requires evidence")

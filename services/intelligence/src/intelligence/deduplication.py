import math
import re

from intelligence.contracts import DuplicateSuggestion, Incident
from intelligence.extraction import folded


def distance_m(a, b):
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    dlat = lat2 - lat1
    dlon = math.radians(b.longitude - a.longitude)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def suggest_duplicates(incident: Incident, candidates: list[Incident]) -> list[DuplicateSuggestion]:
    tokens = set(re.findall(r"\w{3,}", folded(incident.description)))
    suggestions = []
    if len(tokens) < 3:
        return []
    for other in candidates:
        delta = abs((incident.created_at - other.created_at).total_seconds())
        if other.incident_id == incident.incident_id or delta > 7200:
            continue
        other_tokens = set(re.findall(r"\w{3,}", folded(other.description)))
        similarity = len(tokens & other_tokens) / max(1, len(tokens | other_tokens))
        if similarity < 0.45:
            continue
        reasons = ["semelhança textual", "relatos dentro de duas horas"]
        score = similarity * 0.7 + 0.1
        a, b = incident.location, other.location
        if a and b:
            if a.latitude is not None and b.latitude is not None:
                if distance_m(a, b) > 1000:
                    continue
                score += 0.2
                reasons.append("coordenadas próximas; precisão deve ser revisada")
            elif a.reference and folded(a.reference) == folded(b.reference):
                score += 0.15
                reasons.append("mesma referência manual")
        if score >= 0.55:
            suggestions.append(
                DuplicateSuggestion(
                    incident_id=other.incident_id, score=round(min(score, 1), 3), reasons=reasons
                )
            )
    return sorted(suggestions, key=lambda s: s.score, reverse=True)[:5]

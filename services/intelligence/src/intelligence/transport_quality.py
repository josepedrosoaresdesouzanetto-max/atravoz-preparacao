"""Transport counters do not estimate victims, distance, truth, or response priority."""

from collections import Counter


def summarize_transport(deliveries):
    rows = list(deliveries)
    counts = Counter(str(row["incident_id"]) for row in rows)
    hops = Counter(int(row["hops"]) for row in rows)
    if any(value < 0 or value > 4 for value in hops):
        raise ValueError("Only validated mesh hop counts are accepted")
    return {
        "delivered_envelopes": len(rows),
        "distinct_incidents": len(counts),
        "additional_envelopes_same_incident": sum(value - 1 for value in counts.values()),
        "signed_hop_histogram": {str(key): value for key, value in sorted(hops.items())},
        "interpretation": "Transport events only; no estimate of people, proximity, truth or assistance.",
        "scope": "Persisted gateway deliveries; excludes undelivered copies and offline intermediary ACKs.",
    }

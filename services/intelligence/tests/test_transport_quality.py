import pytest
from intelligence.transport_quality import summarize_transport


def test_copy_count_does_not_multiply_incidents_or_people():
    result = summarize_transport(
        [
            {"incident_id": "same-origin", "hops": 2},
            {"incident_id": "same-origin", "hops": 1},
            {"incident_id": "independent-report", "hops": 2},
        ]
    )
    assert result["delivered_envelopes"] == 3
    assert result["distinct_incidents"] == 2
    assert result["additional_envelopes_same_incident"] == 1
    assert result["signed_hop_histogram"] == {"1": 1, "2": 2}
    assert "same-origin" not in str(result)


def test_transport_summary_empty_and_invalid_hops():
    assert summarize_transport([])["distinct_incidents"] == 0
    with pytest.raises(ValueError):
        summarize_transport([{"incident_id": "x", "hops": 5}])

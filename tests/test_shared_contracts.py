import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from intelligence.contracts import Incident
from intelligence.extraction import extract_rules

CASES = json.loads((Path(__file__).resolve().parents[1] / 'packages/contracts/examples.json').read_text(encoding='utf-8'))


@pytest.mark.parametrize('case', CASES, ids=[c['name'] for c in CASES])
def test_shared_examples(case):
    if case['valid']:
        Incident.model_validate(case['payload'])
    else:
        with pytest.raises(ValidationError):
            Incident.model_validate(case['payload'])


@pytest.mark.parametrize('text',['Não tem incêndio na casa.','Três pessoas não estão ilhadas.'])
def test_negative_category_not_asserted(text):
    assert extract_rules(text).suggested_category == 'indeterminado'

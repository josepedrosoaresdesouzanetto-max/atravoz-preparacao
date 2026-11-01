from fastapi.testclient import TestClient
from app.main import app
from intelligence.normalization import normalize


def test_health():
    assert TestClient(app).get('/api/v1/health').json()['status'] == 'ok'


def test_normalization():
    assert normalize('  Água   subindo  ') == 'Água subindo'


def test_empty():
    assert normalize('') == ''

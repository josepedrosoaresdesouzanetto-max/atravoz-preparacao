# ATRAVOZ — preparação privada

A informação encontra outro caminho.

Base de comunicação resiliente para registros em cenários de chuvas extremas no Recife. **Protótipo demonstrativo; não aciona socorro. Use somente dados fictícios.**

Estado deste primeiro marco: interfaces executáveis, contrato versionado, API de saúde e normalização básica. Persistência e sincronização serão desenvolvidas localmente depois da tentativa autorizada de publicação inicial.

## Executar

Python 3.13 e Node 24. Na raiz: `python -m venv .venv`, `.venv/Scripts/python -m pip install -r requirements.txt`, `npm ci`.

API: `.venv/Scripts/python -m uvicorn app.main:app --app-dir services/api --host 127.0.0.1 --port 8000`.

Interfaces: `npm run dev`. Cidadão: http://127.0.0.1:5173/. Central: http://127.0.0.1:5173/central.html.

Testes: `.venv/Scripts/python -m pytest -q` e `npm test`. Build: `npm run build`.

## Equipe e autoria

Idealização e requisitos: contribuição humana do idealizador. Código inicial: gerado com assistência do Codex. Revisão humana e validação com o Movimento Pró-Criança ainda pendentes. Papéis propostos: cidadão/conectividade, API, central, Dados/IA/Qualidade (idealizador); validação com o quinto integrante.

Preparação iniciada em 01/11/2026, anterior ao hackathon. Reutilização depende da organização. Nenhuma licença foi escolhida. Somente um push inicial está autorizado; atualizações posteriores ficam locais.

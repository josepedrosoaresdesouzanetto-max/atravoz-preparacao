# Contratos compartilhados v1

Objetivo: manter cidadão, API, inteligência e central coerentes. Responsabilidade compartilhada, revisão preferencial de Dados/IA/Qualidade. Fonte canônica: `services/intelligence/src/intelligence/contracts.py`. JSON Schema exportado com `scripts/export_contracts.py`; `check_contracts.py` detecta divergência. `src/index.ts` contém validação Zod correspondente.

Entradas/saídas: Incident, Location, AttachmentManifest, ServerReceipt, AIAnalysis; estados técnicos e operacionais separados. `examples.json` é executado tanto por pytest quanto por Vitest, incluindo casos inválidos. Nunca enviar versão incompatível silenciosamente, gerar outro UUID em retentativa ou marcar mídia pelo simples manifesto.

Testes na raiz: `npm test`, `.venv/Scripts/python.exe -m pytest tests/test_shared_contracts.py -q`, `.venv/Scripts/python.exe scripts/check_contracts.py`. Esquemas exportados são artefatos revisáveis, não garantia de que toda equivalência possível entre validadores foi provada.

Estado: versão 1 validada no conjunto compartilhado e integração. Pendência: processo de migração v2 com fixtures v1 antes de mudar produção. Risco: duplicação de definição Python/TypeScript; mitigar ampliando exemplos e revisão cruzada, sem regenerar clientes às cegas.

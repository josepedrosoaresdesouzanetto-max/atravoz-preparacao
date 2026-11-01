# Dados, IA e Qualidade

**Responsabilidade proposta do idealizador.** Objetivo: organizar informação, preservar evidências e tornar incertezas visíveis, sem decidir atendimento. Comece por `OWNER_HANDOFF.md`.

| Arquivo | Responsabilidade |
|---|---|
| src/intelligence/contracts.py | Modelos canônicos Pydantic v1, validação e schemas |
| normalization.py | Cópia normalizada; original não alterado |
| extraction.py | Regras conservadoras e validação de trechos/contagens |
| providers.py | Interface substituível, Ollama loopback e contrato de transcrição indisponível |
| pipeline.py | Isolamento de falhas, fallback, lacunas, rastreabilidade e duração |
| deduplication.py | Sugestões textuais, temporais e geográficas, sem fusão |
| fixtures/synthetic/evaluation.json | Doze casos fictícios com expectativas |
| tests/ | Extração, falhas, segurança e protocolo HTTP do adaptador |
| reports/ | Avaliação realmente executada |

Dependências: Python/Pydantic/httpx; nenhuma dependência da API ou interface. Entrada `Incident`; saída `AIAnalysis`. Contém original, normalizado, saída bruta limitada, modelo/provedor, categoria sugerida, informações, lacunas, duplicidades, limitações, revisão obrigatória e status rules/model/fallback. Exemplos completos em `reports/evaluation.json`.

Na raiz:

```powershell
.venv/Scripts/python.exe -m pytest services/intelligence/tests -q
.venv/Scripts/python.exe scripts/evaluate.py
.venv/Scripts/python.exe scripts/export_contracts.py
.venv/Scripts/python.exe scripts/check_contracts.py
```

Para modelo local já instalado: configure `AI_PROVIDER=ollama`, `OLLAMA_MODEL` com um nome existente e `OLLAMA_URL=http://127.0.0.1:11434` antes de iniciar o servidor. Solicite “Analisar relato” na central. Nenhum modelo foi baixado/executado nesta sessão; esses parâmetros de integração não são prova de inferência real. Timeout padrão 20 s; resposta HTTP limitada a 64 KiB e conteúdo bruto a 16 mil caracteres. Chamadas a URLs externas são recusadas.

Estado: regras, contratos, validação, fallback, duplicidade e avaliação executados; adaptador validado com HTTP simulado. Transcrição só define interface/indisponibilidade; análise de imagem ausente. Limitações: regras estreitas, corpus pequeno e não independente, ambiguidades, contagens em português simples, confiança não calibrada, máximo 200 candidatos recentes na integração. Próximo trabalho: revisão humana, conjunto de teste independente, provedor real e avaliação com fontes apropriadas e consentimento.

# Decisões — origem e situação

| Origem | Contexto / escolha | Motivação, alternativa e risco | Situação |
|---|---|---|---|
| Idealizador | Registro offline com posterior envio | Preservar informação sob falha; alternativa online-only perderia disponibilidade; armazenamento local não garante entrega | Implementado, teste desktop |
| Idealizador | Outro celular transporta dados | Comunidade pode levar informação; alternativas QR/rede local; limitações físicas e compatibilidade | Protocolo parcial, rádio pendente |
| Idealizador | Texto/áudio/foto opcionais, sem vídeo | Baixa fricção e consumo; vídeo adicionaria custo; mídia ainda depende de permissão/recursos | Implementado; hardware pendente |
| Idealizador | Central separada e IA auxiliar | Organizar recebidos sem confundir com resgate; classificação autônoma seria inadequada | Implementado com operador de demonstração |
| Idealizador | Um push privado inicial | Preparação e autoria transparentes; não usar remoto como sync automático | Executado uma vez; demais mudanças locais |
| Assistente | React/TS + IndexedDB + SW | Ferramentas disponíveis e testes web; nativo exige SDK/dispositivos; PWA pode ser suspensa | Implementado |
| Assistente | FastAPI/Pydantic + SQLite | Validação e commits atômicos simples; PostgreSQL futuro; SQLite não atende toda escala prevista | Implementado local |
| Assistente | UUID + capacidade por ocorrência + payload imutável | Idempotência e proteção de upload; correções anexadas; perda da chave exige revisão | Implementado e testado |
| Assistente | Regras padrão + Ollama local substituível | Fluxo sem chave/nuvem, integração testável; modelo externo exigiria autorização/dados; regras limitadas | Regras testadas, modelo real pendente |
| Assistente | Central com token único e uso sintético | Restrição local clara; SSO/RBAC seria requisito de produção | Limitado deliberadamente |
| Assistente | Biome em vez de ESLint | Auditoria inicial apontou vulnerabilidade transitiva; reduzir dependências sem instalar globalmente | Zero alertas npm na verificação posterior |

Decisões definitivas de marca, licença, provedor de IA, implantação, retenção, papéis e elegibilidade de código prévio dependem do proprietário/equipe/organização. Não foram atribuídas automaticamente ao idealizador.

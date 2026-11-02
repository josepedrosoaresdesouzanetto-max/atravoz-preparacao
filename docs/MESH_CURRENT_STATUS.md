> Histórico da fase anterior (pré-0.2.0). Para o estado atual de APK, Bluetooth nativo, Windows, PWA, diagnósticos e IA, leia [INSTALLERS_FINAL_REPORT.md](INSTALLERS_FINAL_REPORT.md) e [INSTALLATION_PHASE.md](INSTALLATION_PHASE.md).

# Estado verificado — 01/11/2026

Implementado e exercitado: store-carry-forward cifrado, credenciais, convites, assinaturas, cotas, IndexedDB persistente, gateway idempotente, recibos de ida/volta, controle voluntário e transporte WebRTC manual. A→B→C→API e retorno C→B→A passaram em três contextos isolados do Edge no mesmo computador. Isso não comprova mesh física de celulares.

| Verificação | Resultado final |
|---|---|
| Python | 63 testes aprovados |
| TypeScript | 36 testes aprovados |
| Navegador / Edge | 7 testes aprovados, incluindo os 5 anteriores |
| Total automatizado | 106 testes; nenhum anterior removido |
| Avaliação IA por regras | 12/12 casos sintéticos; não mede generalização |
| Ruff, Biome, TypeScript, build | Aprovados |
| Schemas canônicos | 3 contratos consistentes |
| Auditoria de dependências | npm e Python: zero vulnerabilidades conhecidas no momento da consulta |
| Testes em celulares físicos | Não realizados; zero aparelhos |
| Instalação Android/iOS | Não realizada |
| Bluetooth, Wi-Fi Direct/Aware | Não implementados/validados |
| Modelo generativo ou transcrição real | Não executados |
| Revisão humana / Pró-Criança | Não realizadas |

Evidências: `evidence/mesh-test-summary.json`, `evidence/mesh-webrtc.json`, `evidence/mesh-origin.png`, `evidence/npm-audit.json`, `evidence/python-audit.json`. Log completo local em work/mesh-final-validation.log, fora do pacote de fonte; saída resumida não confidencial em evidence. Falhas intermediárias e respectivas correções permanecem descritas no diário.

GitHub consultado novamente em modo leitura: privado, main ainda em 406a3df28e4e956058878860545f88ce815600de; nenhum novo push/deploy. O código atual está somente local. A CI remota comprova apenas o esqueleto inicial, não estes 106 testes.

Não afirmar “pronto para resgate”, “Bluetooth funcional”, “instalado em celular”, “três celulares validados” ou “segurança auditada”. A demonstração de software foi comprovada; demonstração segura em três aparelhos requer hardware, rede, revisão e validação adicionais.

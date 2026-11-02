# ATRAVOZ — preparação técnica privada

**A informação encontra outro caminho.**

Protótipo para registrar informações quando a conexão falha, contextualizado para chuvas extremas no Recife. Salva no aparelho, tenta sincronizar e mostra na central somente o que o servidor persistiu. **Não aciona socorro nem representa uma central oficial. Use somente dados fictícios.**

## Estado real — 0.2.0-test

APK Android real recompilado/assinado e central Windows portátil compilada/executada. Bluetooth Classic/RFCOMM implementado; nenhum telefone instalado/testado. Central Mobile PWA usa a mesma API. Diagnósticos JSON/Markdown, envio autorizado e importação local foram testados. 141 casos automatizados aprovados, mais avaliação determinística e verificações dos pacotes.

Transcrição local executada com uma fala sintética e erros registrados. Adaptador generativo disponível; inferência real não executada por bloqueio automático do ambiente, que não foi contornado. Rádio físico, dois/três celulares, instalação da PWA e acesso HTTPS para os aparelhos continuam pendentes.

Leia o [relatório atual](docs/INSTALLERS_FINAL_REPORT.md), [guia de instalação](docs/INSTALLATION_PHASE.md), [teste de dois celulares sem USB](docs/NATIVE_TRANSPORT.md), [diagnósticos](docs/DIAGNOSTICS.md) e [IA local](docs/LOCAL_AI.md). Entregáveis: `outputs/entregas/ATRAVOZ-0.2.0-test`, ao lado desta pasta de código. Relatórios anteriores documentam a fase pré-APK e continuam preservados como histórico. Remoto privado sem novos pushes.

## Abrir no VS Code

Abra `atravoz.code-workspace` ou execute `code atravoz.code-workspace` nesta pasta. Todos os comandos abaixo partem da raiz do projeto. Não é necessário Android Studio para executar a versão web.

## Instalar — PowerShell, Windows

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
npm ci
npm run build
```

Ambiente verificado: Python 3.13.5, Node 24.14.1, npm 11.11.0. As versões resolvidas estão em `requirements.txt` e `package-lock.json`. Não é preciso instalar pacotes globalmente. Se já estiver nesta entrega, `.venv`, `node_modules` e `dist` foram preparados localmente, mas estão fora do Git.

## Executar cidadão, API e central

No PowerShell, configure uma chave local nova antes de iniciar:

```powershell
$env:OPERATOR_TOKEN = .venv/Scripts/python.exe -c "import secrets; print(secrets.token_hex(32))"
$env:OPERATOR_TOKEN
.venv/Scripts/python.exe scripts/serve.py
```

Copie a chave exibida no seu terminal para entrar na central. Não compartilhe nem coloque essa chave no repositório. O servidor **não** imprime a chave. Sem `OPERATOR_TOKEN`, o acesso administrativo fica bloqueado.

- Cidadão: [http://127.0.0.1:8000/](http://127.0.0.1:8000/).
- Central: [http://127.0.0.1:8000/central.html](http://127.0.0.1:8000/central.html).
- Saúde: `/api/v1/health`; prontidão do banco: `/api/v1/ready`.

Espere a indicação de preparação offline antes de desconectar. O primeiro acesso precisa carregar o aplicativo. Encerre com Ctrl+C. Para desenvolvimento com atualização de código: mantenha API em 8000 e execute `npm run dev`; interfaces em 5173. Service Worker é registrado somente no build de produção servido em 8000, não em Vite dev.

O servidor usa loopback por padrão. `127.0.0.1` no celular é o próprio celular, não este computador. Testes físicos precisam de um acesso HTTPS confiável preparado pela equipe; esta entrega não publicou túnel, site ou deploy.

## Testar

```powershell
./scripts/check.ps1
```

Esse comando executa pytest, Ruff, consistência de schemas, Vitest, Biome, TypeScript/build, Playwright e avaliação sintética. O E2E usa Microsoft Edge instalado e banco separado. Não altera o banco de demonstração. Em outro ambiente, configure `E2E_CHANNEL` e prepare o navegador compatível; o workflow local configura Chromium para Linux, ainda não executado remotamente na versão final.

Comandos individuais: `.venv/Scripts/python.exe -m pytest -q`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test:e2e`, `.venv/Scripts/python.exe scripts/evaluate.py`. Microbenchmark: `.venv/Scripts/python.exe scripts/benchmark.py`. Não foi medida cobertura percentual.

## Mapa de trabalho

| Área | Pasta / ponto de entrada | Responsabilidade proposta |
|---|---|---|
| Cidadão, fila, mídia e localização | `apps/citizen-app/src/App.tsx`, `src/features/` | Desenvolvedor 1 |
| Mesh e transporte | `packages/mesh-core`, `features/mesh` | Desenvolvedor 1, com revisão do Dev 2 |
| Experimento histórico sem rádio | `experiments/bluetooth-android` | Referência de laboratório |
| API, SQLite e segurança | `services/api/app/main.py` | Desenvolvedor 2 |
| Central autenticada | `apps/operations-dashboard/src/Dashboard.tsx` | Desenvolvedor 3 |
| Dados, IA e Qualidade | `services/intelligence` | Idealizador, proposta a confirmar |
| Contratos | `packages/contracts` | Acordo dos desenvolvedores |
| Testes e exemplos | `tests`, testes dos serviços, `fixtures` | Responsabilidade compartilhada |
| Validação do público | `docs/23_PRODUCT_VALIDATION.md` | Validador ainda não definido |

Comece pelo [handoff do idealizador](services/intelligence/OWNER_HANDOFF.md). Os nomes e habilidades da equipe não foram inventados.

## Configuração e privacidade

`.env.example` documenta variáveis; o servidor não carrega `.env` automaticamente. Use variáveis do PowerShell/processo. `APP_NAME` altera a marca retornada pela API, `VITE_APP_NAME` altera a marca inicial no build; título e manifesto também devem ser revisados numa troca definitiva de marca. `DATABASE_PATH` muda o banco. `AI_PROVIDER=rules` é o padrão. Para modelo local já instalado, consulte `services/intelligence/README.md`.

Não limpe dados do navegador com registros pendentes. IndexedDB não é backup nem armazenamento cifrado pelo aplicativo. O SQLite está em `runtime/`, ignorado pelo Git. Acesso administrativo é uma chave de operador único para demonstração, não um sistema de contas de produção. Política de retenção e infraestrutura operacional precisam de aprovação humana.

## Publicação, autoria e evento

[Repositório privado](https://github.com/josepedrosoaresdesouzanetto-max/atravoz-preparacao): recebeu **somente** o esqueleto inicial `406a3df28e4e956058878860545f88ce815600de`. [CI inicial aprovada](https://github.com/josepedrosoaresdesouzanetto-max/atravoz-preparacao/actions/runs/41274626854), com 3 testes Python e 2 TypeScript. A versão final é mais avançada e está apenas local. Não fazer novo push, PR, release, tag remota ou deploy sem autorização explícita.

Concepção e especificação: contribuição humana do idealizador. Implementação, testes e documentação: assistência do Codex, agente baseado em GPT-6. Revisão humana e validação Pró-Criança ainda não realizadas. Preparação criada em 01/11/2026, anterior ao evento; reutilização depende das regras e orientações da organização. Nenhuma licença foi escolhida pelo proprietário; não foi adicionado arquivo LICENSE.

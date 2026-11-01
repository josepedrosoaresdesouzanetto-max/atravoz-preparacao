# Instalação e operação local

Abra a pasta ATRAVOZ no VS Code, conforme README. Requisitos exercitados: Windows, Python 3.13.5, Node 24.14.1 e Edge. O ZIP de fonte não contém dependências, bancos, chaves ou credenciais.

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
npm ci
npm run build
$env:OPERATOR_TOKEN = .venv/Scripts/python.exe -c "import secrets; print(secrets.token_hex(32))"
.venv/Scripts/python.exe scripts/serve.py
```

Sem mesh provisionada, salvar offline, sincronizar diretamente, mídia, central e IA por regras continuam disponíveis. Cidadão em http://127.0.0.1:8000/; central em /central.html. A chave do operador está na variável definida no seu próprio terminal; use-a apenas na central. Nenhuma chave real está neste documento.

## Preparar autoridade mesh antes do exercício

Encerre o servidor. Defina MESH_KEY_PASSWORD com pelo menos 32 caracteres aleatórios e guarde-a em gerenciador seguro fora do repositório. O script gera arquivos cifrados e recusa sobrescrever chaves existentes.

```powershell
$env:MESH_KEY_DIR = (Join-Path (Get-Location) 'runtime/mesh-keys')
# Defina MESH_KEY_PASSWORD de forma segura no ambiente deste processo.
.venv/Scripts/python.exe scripts/provision_mesh.py
.venv/Scripts/python.exe scripts/serve.py
```

Para emitir um convite com o servidor já iniciado, abra outro terminal autorizado com OPERATOR_TOKEN configurado:

```powershell
$headers = @{ Authorization = "Bearer $env:OPERATOR_TOKEN" }
$invite = Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:8000/api/v1/mesh/invitations' -Headers $headers
$invite
```

Transmita convite e authority_id ao participante por canal confiável. Convite dura dez minutos e funciona uma vez. No cidadão, preencha identificador e convite em “Preparar este aparelho”; depois ative “Participar da Rede Solidária”. Renovação usa novo convite e preserva a chave local. Não compartilhe a chave administrativa com voluntários. Para revogar: POST /api/v1/mesh/revoke com JSON `{"subject":"ID público do participante"}` e autenticação administrativa; pares offline só saberão ao atualizar a lista.

## Encontro manual e demonstração

Conecte dois participantes autorizados em rede compatível. Um cria oferta, o outro cola e aceita; leve a resposta de volta e finalize no primeiro. Aguarde canal validado e use “Trocar mensagens e recibos”. O envio à central requer Wi-Fi confirmado na sessão ou permissão explícita de rede móvel/desconhecida. Os recibos podem voltar em encontros posteriores. Não publicar SDP/códigos.

## PWA e aparelhos físicos

Manifesto com ícones PNG 192/512 e SVG, Service Worker versionado e fluxo de instalação condicional implementados. Abertura offline foi testada em navegador desktop. Não houve instalação física em Android/iOS. Botão de instalar só aparece quando o navegador oferece beforeinstallprompt; aceitar o prompt não é tratado como instalação já concluída.

Android: menu do navegador → Instalar/Adicionar à tela inicial, quando disponível. iOS: Safari → Compartilhar → Adicionar à Tela de Início, sujeito à compatibilidade. Abra online e aguarde preparação offline antes de desconectar. Não limpar armazenamento pendente.

O telefone não alcança este computador pelo seu próprio 127.0.0.1. Para teste LAN, a equipe deve fornecer certificado confiável e rede configurada, definir HOST para endereço de LAN (ou 0.0.0.0 conscientemente), TLS_CERT_FILE e TLS_KEY_FILE. O servidor suporta essas variáveis; certificado e instalação em telefone não foram preparados/validados aqui. Não houve exposição externa. Nunca contornar erros de certificado como prova de instalação segura.

APK nativo não existe nesta entrega. Android SDK/adb/Gradle/javac não estavam disponíveis; gerar um pacote vazio não comprovaria rádio. Central não é PWA offline e exige autenticação. Scripts de teste criam autoridade cifrada temporária em runtime; não reutilizar essas chaves de teste para apresentação.

Verificação: `./scripts/check.ps1`. Todas as ferramentas são locais; E2E usa banco e autoridade de teste separados. Sem novos pushes ou deploy.

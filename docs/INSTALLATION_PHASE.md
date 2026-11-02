# ATRAVOZ 0.2.0-test — instalação e uso

Preparação técnica privada, 2026-11-01. Somente dados fictícios. Recebimento não significa atendimento. Esta fase continua o commit fbf2d4d; os relatórios anteriores são históricos.

## Android, sem cabo USB

O arquivo da entrega é `Android/ATRAVOZ-Cidadao-0.2.0-test.apk`. Copie-o para seus dois celulares pelo meio que você escolher: compartilhamento de arquivo, armazenamento privado ou transferência local. Nada foi publicado nem enviado automaticamente. Confira o SHA-256 no manifesto da entrega antes de distribuir.

1. Abra o APK no gerenciador de arquivos do Android. Se solicitado, autorize temporariamente **instalar apps desconhecidos** para esse gerenciador. Instale e depois retire essa autorização.
2. Abra **ATRAVOZ Cidadão**. O APK inclui a interface; pode registrar dados fictícios sem configurar servidor e sem internet. Não limpe dados nem desinstale enquanto houver registros pendentes.
3. Câmera, microfone e localização são opcionais. Recusar uma permissão não deve impedir registro mínimo. Confirme isso no aparelho: essas permissões ainda não foram exercitadas fisicamente.
4. Para sincronizar, em **Conexão com a central**, configure somente a origem HTTPS confiável preparada pela equipe, sem `/central/` ou `/api`. Confira a disponibilidade antes de enviar. Não aceite certificado inválido.
5. Para atualizar, abra o próximo APK com **mesmo identificador e mesma assinatura** e versão superior, sem desinstalar. O código mantém o banco; atualização real ainda precisa ser testada em telefone.

Identificador `br.org.atravoz.cidadao`, nome `ATRAVOZ Cidadão`, versão `0.2.0-test`, versionCode `2`, mínimo Android 7/API 24, alvo API 36. Compatibilidade declarada não equivale a todos esses aparelhos testados. WebView e Bluetooth Classic disponíveis são pré-requisitos do teste de rádio. iOS não recebe este APK e não possui o transporte nativo implementado.

Permissões: internet/estado de rede; câmera/microfone; localização opcional e descoberta Bluetooth nas versões antigas; Bluetooth legado até API 30 e SCAN/CONNECT/ADVERTISE nas recentes. Sem contatos, SMS, armazenamento amplo, autostart ou serviço permanente. Backup Android desativado; HTTP em texto claro desativado. APK de desenvolvimento, sem assinatura de publicação ou distribuição em loja.

## Windows

Extraia **todo** `ATRAVOZ-Central-Windows-0.2.0-test.zip` em uma pasta do usuário. Abra `ATRAVOZ-Central/ATRAVOZ-Central.exe`; mantenha `_internal` ao lado. Não é necessário Python instalado para esse executável. A solução desta fase é um iniciador portátil compilado, não um assistente `Setup.exe` nem um serviço Windows.

Clique **Abrir central no navegador** e **Copiar chave do operador**; cole a chave no campo de acesso da central. A chave é temporária por execução, mantida em memória, não embutida na URL. Fechar o iniciador encerra sua API; registros continuam em `%LOCALAPPDATA%/ATRAVOZ/Central`. Porta local livre escolhida automaticamente. Segunda instância na mesma pasta é recusada.

Não há mudança de firewall, inicialização automática, registro global ou publicação. O executável não tem certificado Authenticode de editor; controles do Windows podem solicitar confirmação ou bloqueá-lo. Não desligue proteções do sistema para forçar execução. Para atualizar, feche a central e extraia a nova pasta portátil; os dados ficam fora dela. Para remover, apague somente a pasta portátil depois de fechar; os dados não são apagados automaticamente. Preserve a pasta de dados se quiser histórico.

As chaves da autoridade mesh ficam cifradas, com senha protegida por DPAPI da conta Windows. Não copie apenas o banco para outra conta acreditando que isso migra a autoridade: é necessário plano de migração/backup de chaves revisado pela equipe. Não compartilhe `.dpapi`, PEM, banco ou chave de operador como diagnóstico.

## Central Mobile e a mesma API

A central usa a mesma aplicação em `/central/`. Acesse **a origem HTTPS da mesma API** no celular, autentique e use Instalar/Adicionar à tela inicial. O manifesto e o Service Worker são próprios da central. Somente interface/ícones/scripts entram no cache; dados autenticados, relatos e anexos não entram. Sem conexão, a interface informa que dados exibidos pertencem à última consulta; novas consultas exigem conexão e autenticação.

O endereço `127.0.0.1` do iniciador Windows funciona apenas naquele computador. No celular ele aponta para o próprio celular. Acesso entre celular e PC requer HTTPS confiável alcançável pela rede, preparado pela equipe. **Nenhum certificado, domínio, túnel, publicação ou abertura de firewall foi configurado nesta fase.** Sem esse pré-requisito, registro offline funciona; provisionamento, sincronização com a central e instalação física da Central Mobile ficam pendentes.

Para a equipe técnica, `scripts/serve.py` já permite `HOST`, `PORT`, `TLS_CERT_FILE` e `TLS_KEY_FILE`, além de `DATABASE_PATH`, `OPERATOR_TOKEN` e chaves mesh. Use uma única API e banco; não inicie outra autoridade achando que é a mesma central. Exposição em rede deve ser intencional, privada e revisada. A versão portátil serve loopback apenas por decisão de segurança. Isso não impede o rádio Bluetooth depois que as credenciais já tiverem sido provisionadas.

## Reconstruir o APK e preservar a assinatura

No projeto, instale dependências com `npm ci`. Configure JDK 21 em `JAVA_HOME`, SDK Android em `ANDROID_HOME`, plataforma 36, build-tools 36.0.0 e 35.0.0. O wrapper baixa Gradle 8.14.3. A preparação desta máquina foi feita em `work/android-toolchain`, sem instalação global.

Execute `scripts/build-android.ps1`. A chave atual está em `.local/android-debug.keystore`, ignorada pelo Git e excluída dos arquivos de entrega. O alias `androiddebugkey` e a senha padrão `android` são próprios de assinatura de desenvolvimento; não servem para produção. Mantenha cópia privada dessa chave para atualizações. Não gere outra chave para atualizar instalações existentes.

Somente para uma instalação nova, sem chave anterior a preservar, o responsável pode criar uma chave de desenvolvimento com `keytool -genkeypair -keystore .local/android-debug.keystore -alias androiddebugkey -keyalg RSA -keysize 3072 -validity 3650 -storepass android -keypass android -dname "CN=ATRAVOZ Development,O=Prototype,C=BR"`. Crie `.local` antes. Não inclua a chave no Git.

Reconstrução Windows: instale `requirements-build.txt` na `.venv` e execute `scripts/build-windows.ps1`. O resultado fica em `runtime/windows-build/dist`. O empacotamento usa caminhos absolutos para os recursos, corrigindo a resolução relativa ao diretório do arquivo `.spec` que causou a falha inicial.

## Diagnósticos e continuidade

Abra **Diagnóstico técnico e exportação** no cidadão. Exporte JSON e Markdown, revise e anexe manualmente ao ChatGPT/Codex. Não é preciso central para exportar. Envio à API exige credencial de participante, autorização explícita e confirmação de Wi-Fi; nenhuma exportação é enviada automaticamente. Veja [diagnósticos](DIAGNOSTICS.md), [teste sem USB](NATIVE_TRANSPORT.md) e [IA local](LOCAL_AI.md).

# Baseline da fase de instalação — 01/11/2026

Repositório preservado: outputs/atravoz, branch main, HEAD fbf2d4d22baeea4d06fef32fca8d9bd0a6ab81a8. Status Git limpo antes da execução; remoto configurado para atravoz-preparacao privado, sem operação de push. Código existente inspecionado: cidadão/IndexedDB/fila, central, API/SQLite, mesh-core JOSE/WebRTC, inteligência e testes.

Suite repetida antes da implementação: 63 pytest + 36 Vitest + 7 Playwright = 106 aprovados. Build, Ruff, Biome, TypeScript e três schemas aprovados; avaliação sintética 12/12. Log local work/install-baseline-validation.log. Resultados anteriores não foram apenas presumidos.

Inspeção inicial: Node 24, Python 3.13, JRE Java 8 e dotnet presentes. SDK Android, javac, Gradle, adb, Inno Setup/NSIS não encontrados. Cerca de 150 GiB livres. Nenhuma credencial de provedor generativo encontrada. Não havia APK, transporte nativo de rádio, instalação física, central empacotada ou inferência/transcrição reais comprovadas.

Reuso escolhido: Capacitor 8.6.0 para os mesmos assets React/IndexedDB; plugin Android próprio para RFCOMM Bluetooth Classic, mantendo o mesh-core e seus recibos. SDK/JDK portáteis obtidos de fontes oficiais e verificados por checksum, confinados à pasta work. Nenhuma alteração do Java global ou publicação externa. Central Windows seguirá com iniciador local de API + navegador, evitando uma segunda aplicação incompatível.

Referências de decisão: documentação Capacitor de ambiente/plugins Android; documentação Android de permissões e conexões RFCOMM. BLE exigiria GATT/fragmentação e papéis periférico/central; Wi-Fi Direct exige negociação IP e gerenciamento de grupos; Aware depende do hardware; Nearby acrescentaria dependência de Play Services. O primeiro adaptador será RFCOMM, em primeiro plano e com ações explícitas de descoberta/conexão. Compilação não comprovará funcionamento de rádio.

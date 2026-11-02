"""Validate an exported technical report locally. Never execute or upload its contents."""

import argparse
from collections import Counter
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "services/api"))
sys.path.insert(0, str(ROOT / "services/intelligence/src"))
from app.diagnostics import DiagnosticReport  # noqa: E402


def inspect_report(path):
    with Path(path).open("rb") as stream:
        data = stream.read(262145)
    if len(data) > 262144:
        raise ValueError("Report exceeds 256 KiB")
    report = DiagnosticReport.model_validate_json(data)
    counts = Counter()
    for event in report.events:
        counts[event.code] += event.count
    lines = [
        "# ATRAVOZ — análise técnica local",
        "",
        f"Relatório: {report.report_id}. Criado: {report.created_at.isoformat()}.",
        "",
        "Arquivo validado por lista fechada de campos. Nenhum conteúdo foi executado ou enviado.",
        "",
        "## Evidências",
        "",
    ]
    lines += [f"- {code}: {count}" for code, count in counts.most_common()]
    lines += ["", "## Linha do tempo para reprodução", ""]
    lines += [
        f"- {e.at.isoformat()} | {e.platform} | {e.version} | {e.module}/{e.operation} | "
        f"{e.code} | resultado={e.result}, recuperação={e.recovery}, tentativas={e.attempt}, "
        f"duração={e.duration_ms} ms | correlação={e.correlation_id}"
        for e in sorted(report.events, key=lambda event: event.at.isoformat())
    ]
    lines += [
        "",
        "## Próximo teste humano",
        "",
        "Repita apenas com dados fictícios. Anote passos, versão do Android, horário, permissões e estados exibidos.",
        "Compare com o roteiro de dois aparelhos. O modelo do aparelho pode ser informado manualmente, sem número de série.",
        "Códigos de erro e coincidências temporais são evidências; não demonstram sozinhos uma causa raiz.",
        "",
        "## Limitações",
        "",
        "Amostra limitada e agrupada; ausência de evento não comprova ausência de falha. "
        "Este arquivo não autentica quem exportou o JSON nem prova transmissão física. "
        "Validação de schema não substitui revisão humana de privacidade antes de compartilhar.",
    ]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("report", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        result = inspect_report(args.report)
    except Exception:
        raise SystemExit(
            "Relatório inválido, incompatível ou acima do limite; nenhum conteúdo importado."
        ) from None
    # No silent overwrite of an existing report, input file, or source file.
    with args.output.open("x", encoding="utf-8") as stream:
        stream.write(result)
    print("Relatório técnico validado e analisado localmente.")


if __name__ == "__main__":
    main()

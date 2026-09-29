from __future__ import annotations

import json
import sys
from pathlib import Path

from parasolid_kit import ParseLimits, read_brep, read_compact_onshape_brep
from parasolid_kit.interop import InteropLimits
from parasolid_kit.interop.occt import to_occt
from parasolid_kit.interop.preview import PreviewOptions, write_preview


MAX_INPUT_BYTES = 50 * 1024 * 1024
COMPACT_PARSE_THRESHOLD_BYTES = 50 * 1024 * 1024
MAX_OUTPUT_BYTES = 32 * 1024 * 1024
PARSE_LIMITS = ParseLimits(
    max_file_size=MAX_INPUT_BYTES,
    max_nodes=1_000_000,
    max_schema_types=16_384,
    max_fields_per_type=4_096,
    max_string_bytes=8 * 1024 * 1024,
    max_variable_elements=1_000_000,
    max_diagnostics=1_000,
)
CONVERSION_LIMITS = InteropLimits(
    max_entities=150_000,
    max_occt_subshapes=300_000,
    max_curve_samples=300_000,
    max_triangles=1_200_000,
    max_vertices=2_400_000,
    max_output_bytes=MAX_OUTPUT_BYTES,
    max_diagnostics=1_000,
)


def create_preview(source_path: Path, output_path: Path) -> None:
    suffix = source_path.suffix.lower()
    if suffix not in {".x_t", ".x_b"}:
        raise ValueError("Only .x_t and .x_b files can be previewed")
    if source_path.stat().st_size > MAX_INPUT_BYTES:
        raise ValueError("Input is too large for inline preview")

    source_format = "x-t" if suffix == ".x_t" else "x-b"
    input_size = source_path.stat().st_size
    if suffix == ".x_b" and input_size > COMPACT_PARSE_THRESHOLD_BYTES:
        raise ValueError("Large .x_b files cannot be previewed inline")

    if suffix == ".x_t" and input_size > COMPACT_PARSE_THRESHOLD_BYTES:
        brep = read_compact_onshape_brep(source_path, limits=PARSE_LIMITS)
    else:
        brep = read_brep(
            source_path,
            source_format=source_format,
            limits=PARSE_LIMITS,
        ).brep

    converted = to_occt(
        brep,
        source_unit="mm",
        target_unit="mm",
        require_complete=True,
        limits=CONVERSION_LIMITS,
    )
    output_path.mkdir(parents=True, exist_ok=True)
    result = write_preview(
        converted,
        brep,
        output_path,
        options=PreviewOptions(
            linear_deflection=0.1,
            angular_deflection=0.5,
            include_edges=False,
            allow_partial=False,
        ),
        limits=CONVERSION_LIMITS,
    )
    if not result.report.glb_validation.valid:
        raise ValueError("The generated GLB failed validation")
    if result.glb_path.stat().st_size > MAX_OUTPUT_BYTES:
        raise ValueError("The generated preview is too large")
    report = result.report
    (output_path / "preview-report.json").write_text(
        json.dumps(
            {
                "partial": report.partial,
                "sourceComplete": report.source_complete,
                "missingFaceCount": report.missing_face_count,
                "missingEdgeCount": report.missing_edge_count,
            }
        ),
        encoding="utf-8",
    )


def main() -> int:
    if len(sys.argv) != 3:
        print("Expected source and output paths", file=sys.stderr)
        return 2

    try:
        create_preview(Path(sys.argv[1]), Path(sys.argv[2]))
    except Exception as error:
        detail = " ".join(str(error).split())[:240]
        print(f"{type(error).__name__}: {detail}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
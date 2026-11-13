"""
Inspección rápida de un asset sin modificarlo ni exportar nada.

    blender -b --python tools/blender/inspect_model.py -- --input assets/src/sneaker.fbx [--report out/inspect.json]

Imprime objetos, triángulos, materiales, UVs, dimensiones y advertencias de normales/UVs.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
import sneakerlab_pipeline as sl  # noqa: E402

if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    import argparse

    p = argparse.ArgumentParser()
    p.add_argument("--input", required=True)
    p.add_argument("--report")
    a = p.parse_args(argv)

    report = sl.Report()
    sl.reset_scene()
    sl.import_model(a.input, report)
    sl.inspect(report)
    for obj in sl.mesh_objects():
        sl.check_normals(obj, report)
        sl.check_uvs(obj, report, require_island=False)
    report.write(a.report)
    print(f"\n{len(report.objects)} mallas · {len(report.warnings)} advertencias · {len(report.errors)} errores")

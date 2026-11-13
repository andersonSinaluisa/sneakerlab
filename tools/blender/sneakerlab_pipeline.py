"""
SneakerLab 3D — Pipeline de preparación de modelos en Blender (3.6+ / 4.x).

Uso (sin interfaz):
    blender -b --python tools/blender/sneakerlab_pipeline.py -- \
        --input  assets/src/sneaker.fbx \
        --output public/models/sneaker-low-02.glb \
        --manifest src/config/models/sneaker-low-02.json \
        --mapping tools/blender/mapping.example.json \
        [--decimate 0.6] [--report out/report.json] [--strict]

Qué hace, en orden:
 1. Importa el modelo (FBX, OBJ, GLB/GLTF, BLEND) en una escena nueva.      → no toca el original
 2. Inspecciona objetos, mallas, materiales, triángulos, UVs y normales.
 3. Valida: normales coherentes, UVs presentes y dentro de 0..1 en paneles
    personalizables, sin UVs solapadas, nombres duplicados, escala aplicada.
 4. Detecta paneles personalizables por nombre/material (reglas del mapping)
    y los renombra con la convención `R_<Zona>` / `L_<Zona>`.
 5. Crea materiales PBR Principled coherentes con los presets del frontend.
 6. Optimiza: aplica transformaciones, elimina dobles, triangula, decimado opcional.
 7. Exporta GLB (+Draco opcional) y actualiza el manifiesto JSON de SneakerLab.
 8. Escribe un informe JSON con errores y advertencias. Con --strict, un error
    aborta la exportación.

El mapping (JSON) relaciona nombres originales con zonas:
{
  "shoes": { "right": "shoe_R", "left": "shoe_L" },        # objetos/colecciones raíz (o "mirror": true)
  "zones": {
    "outer":  { "match": ["side_out", "lateral"], "mirrorFromRight": true },
    "laces":  { "match": ["lace"], "material": "lace" }
  }
}
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
from dataclasses import dataclass, field, asdict

try:
    import bpy  # type: ignore
    import bmesh  # type: ignore
    from mathutils import Vector  # type: ignore
except ImportError:  # permite importar el módulo para pruebas fuera de Blender
    bpy = None  # type: ignore

# ---------------------------------------------------------------------------
# Informe
# ---------------------------------------------------------------------------


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    info: list[str] = field(default_factory=list)
    objects: list[dict] = field(default_factory=list)
    zones: dict = field(default_factory=dict)

    def error(self, msg: str):
        self.errors.append(msg)
        print(f"[ERROR] {msg}")

    def warn(self, msg: str):
        self.warnings.append(msg)
        print(f"[WARN]  {msg}")

    def note(self, msg: str):
        self.info.append(msg)
        print(f"[INFO]  {msg}")

    def write(self, path: str | None):
        if not path:
            return
        os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(asdict(self), f, indent=2, ensure_ascii=False)
        print(f"Informe escrito en {path}")


# ---------------------------------------------------------------------------
# Presets PBR (espejo de src/lib/materials/presets.ts)
# ---------------------------------------------------------------------------

PBR_PRESETS = {
    "leather": dict(roughness=0.55, metallic=0.0, clearcoat=0.12, clearcoat_roughness=0.5, sheen=0.0),
    "suede": dict(roughness=0.92, metallic=0.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.8),
    "canvas": dict(roughness=0.85, metallic=0.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.35),
    "mesh": dict(roughness=0.75, metallic=0.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.5),
    "rubber": dict(roughness=0.78, metallic=0.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.0),
    "foam": dict(roughness=0.60, metallic=0.0, clearcoat=0.05, clearcoat_roughness=0.8, sheen=0.0),
    "lace": dict(roughness=0.80, metallic=0.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.4),
    "metal": dict(roughness=0.35, metallic=1.0, clearcoat=0.0, clearcoat_roughness=0.5, sheen=0.0),
}

# Zonas estándar de SneakerLab con su material por defecto y si admiten impresión
ZONE_DEFAULTS = {
    "outer": dict(label="Lateral exterior", material="leather", images=True),
    "inner": dict(label="Lateral interior", material="leather", images=True),
    "toe": dict(label="Punta", material="leather", images=True),
    "heel": dict(label="Talón", material="leather", images=True),
    "tongue": dict(label="Lengüeta", material="canvas", images=True),
    "laces": dict(label="Cordones", material="lace", images=False),
    "eyelets": dict(label="Ojales", material="metal", images=False),
    "midsole": dict(label="Entresuela", material="foam", images=False),
    "outsole": dict(label="Suela", material="rubber", images=False),
    "collar": dict(label="Cuello acolchado", material="canvas", images=False),
    "insole": dict(label="Plantilla", material="canvas", images=False),
}

ZONE_MESH_SUFFIX = {
    "outer": "OuterPanel", "inner": "InnerPanel", "toe": "ToeCap", "heel": "HeelCounter",
    "tongue": "Tongue", "laces": "Laces", "eyelets": "Eyelets", "midsole": "Midsole",
    "outsole": "Outsole", "collar": "Collar", "insole": "Insole",
}

# ---------------------------------------------------------------------------
# Utilidades de Blender
# ---------------------------------------------------------------------------


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def import_model(path: str, report: Report):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".blend":
        # Carga como librería para no modificar el .blend original
        with bpy.data.libraries.load(path, link=False) as (src, dst):
            dst.objects = src.objects
        for obj in dst.objects:
            if obj is not None:
                bpy.context.scene.collection.objects.link(obj)
    else:
        report.error(f"Formato no soportado: {ext}")
        return
    report.note(f"Importado {path}: {len(bpy.data.objects)} objetos")


def mesh_objects():
    return [o for o in bpy.data.objects if o.type == "MESH"]


def inspect(report: Report):
    for obj in mesh_objects():
        me = obj.data
        tris = sum(len(p.vertices) - 2 for p in me.polygons)
        uv_layers = [uv.name for uv in me.uv_layers]
        mats = [m.name for m in me.materials if m]
        bbox = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
        dims = [max(v[i] for v in bbox) - min(v[i] for v in bbox) for i in range(3)]
        info = dict(
            name=obj.name, vertices=len(me.vertices), triangles=tris, uv_layers=uv_layers,
            materials=mats, dimensions=[round(d, 4) for d in dims],
            scale=[round(s, 4) for s in obj.scale],
        )
        report.objects.append(info)
        if any(abs(s - 1.0) > 1e-4 for s in obj.scale):
            report.warn(f"{obj.name}: escala no aplicada {info['scale']} (se aplicará)")
        if not uv_layers:
            report.warn(f"{obj.name}: sin UV map")
        if tris > 60000:
            report.warn(f"{obj.name}: {tris} triángulos, considera decimar")


def check_normals(obj, report: Report):
    """Detecta caras invertidas comparando la normal con el vector al centroide."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bm.faces.ensure_lookup_table()
    center = sum((v.co for v in bm.verts), Vector()) / max(1, len(bm.verts))
    flipped = 0
    for f in bm.faces:
        outward = (f.calc_center_median() - center)
        if outward.length > 1e-6 and f.normal.dot(outward) < -0.3:
            flipped += 1
    bm.free()
    ratio = flipped / max(1, len(me.polygons))
    if ratio > 0.5:
        report.warn(f"{obj.name}: {flipped} caras parecen invertidas ({ratio:.0%}); se recalculan normales")
        return True
    if ratio > 0.1:
        report.warn(f"{obj.name}: {flipped} caras con normal dudosa ({ratio:.0%}); revisar manualmente")
    return False


def check_uvs(obj, report: Report, require_island: bool) -> dict | None:
    """Valida UVs; devuelve el rectángulo de la isla (u0,v0,u1,v1) en convención glTF (v hacia abajo)."""
    me = obj.data
    if not me.uv_layers:
        if require_island:
            report.error(f"{obj.name}: panel personalizable sin UVs")
        return None
    uv = me.uv_layers.active.data
    us = [l.uv.x for l in uv]
    vs = [l.uv.y for l in uv]
    u0, u1, v0, v1 = min(us), max(us), min(vs), max(vs)
    if u0 < -1e-3 or v0 < -1e-3 or u1 > 1 + 1e-3 or v1 > 1 + 1e-3:
        msg = f"{obj.name}: UVs fuera de 0..1 (u {u0:.2f}..{u1:.2f}, v {v0:.2f}..{v1:.2f})"
        report.error(msg) if require_island else report.warn(msg)
    area = (u1 - u0) * (v1 - v0)
    if require_island and area < 0.2:
        report.warn(f"{obj.name}: la isla UV ocupa solo {area:.0%} de la textura; baja resolución de impresión")
    # Solapes: muestreo de triángulos en una rejilla
    if require_island:
        grid = {}
        overlaps = 0
        for poly in me.polygons:
            pts = [uv[i].uv for i in poly.loop_indices]
            cx = sum(p.x for p in pts) / len(pts)
            cy = sum(p.y for p in pts) / len(pts)
            key = (int(cx * 64), int(cy * 64))
            overlaps += grid.get(key, 0) > 3
            grid[key] = grid.get(key, 0) + 1
        if overlaps > len(me.polygons) * 0.05:
            report.warn(f"{obj.name}: posibles UVs solapadas (las impresiones se repetirían)")
    # Blender: v=0 abajo; glTF: v=0 arriba → invertir
    return dict(u0=round(u0, 4), v0=round(1 - v1, 4), u1=round(u1, 4), v1=round(1 - v0, 4))


def match_zone(name: str, material_names: list[str], mapping: dict) -> str | None:
    hay = (name + " " + " ".join(material_names)).lower()
    for zone_id, rule in mapping.get("zones", {}).items():
        for token in rule.get("match", []):
            if token.lower() in hay:
                return zone_id
    return None


def side_of(obj, mapping: dict) -> str | None:
    shoes = mapping.get("shoes", {})
    for side in ("right", "left"):
        root = shoes.get(side)
        if not root:
            continue
        o = obj
        while o:
            if o.name == root or (o.users_collection and any(c.name == root for c in o.users_collection)):
                return side
            o = o.parent
    # heurística por sufijo
    n = obj.name.lower()
    if n.endswith((".r", "_r", "-r", "right")):
        return "right"
    if n.endswith((".l", "_l", "-l", "left")):
        return "left"
    return None


def ensure_pbr_material(obj, preset_id: str, zone_id: str):
    """Crea un material Principled con los valores del preset, conservando texturas existentes."""
    name = f"SL_{zone_id}_{preset_id}"
    mat = bpy.data.materials.get(name)
    if mat is None:
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
    bsdf = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf is None:
        bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    p = PBR_PRESETS[preset_id]
    bsdf.inputs["Roughness"].default_value = p["roughness"]
    bsdf.inputs["Metallic"].default_value = p["metallic"]
    for key, inp in (("clearcoat", "Coat Weight"), ("clearcoat_roughness", "Coat Roughness"), ("sheen", "Sheen Weight")):
        if inp in bsdf.inputs:
            bsdf.inputs[inp].default_value = p[key]
    # Reutiliza el mapa de normales del material original si existe
    old = obj.active_material
    if old and old.use_nodes:
        for n in old.node_tree.nodes:
            if n.type == "NORMAL_MAP" and "Normal" in bsdf.inputs:
                new_n = mat.node_tree.nodes.new("ShaderNodeNormalMap")
                new_n.inputs["Strength"].default_value = n.inputs["Strength"].default_value
                for link in old.node_tree.links:
                    if link.to_node == n and link.from_node.type == "TEX_IMAGE":
                        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
                        tex.image = link.from_node.image
                        tex.image.colorspace_settings.name = "Non-Color"
                        mat.node_tree.links.new(tex.outputs["Color"], new_n.inputs["Color"])
                mat.node_tree.links.new(new_n.outputs["Normal"], bsdf.inputs["Normal"])
                break
    obj.data.materials.clear()
    obj.data.materials.append(mat)


def optimize(obj, decimate: float | None, report: Report):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.mesh.quads_convert_to_tris()
    bpy.ops.object.mode_set(mode="OBJECT")
    if decimate and 0 < decimate < 1:
        mod = obj.modifiers.new("SL_Decimate", "DECIMATE")
        mod.ratio = decimate
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
        report.note(f"{obj.name}: decimado a {decimate:.0%}")


def export_glb(path: str, draco: bool):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_normals=True,
        export_texcoords=True,
        export_materials="EXPORT",
        export_draco_mesh_compression_enable=draco,
        export_draco_mesh_compression_level=6,
        use_selection=False,
    )


# ---------------------------------------------------------------------------
# Pipeline principal
# ---------------------------------------------------------------------------


def run(args):
    report = Report()
    with open(args.mapping, encoding="utf-8") as f:
        mapping = json.load(f)

    reset_scene()
    import_model(args.input, report)
    inspect(report)

    zones_found: dict[str, dict[str, str]] = {}
    islands: dict[str, dict] = {}
    roots = {"right": None, "left": None}

    for obj in mesh_objects():
        zone_id = match_zone(obj.name, [m.name for m in obj.data.materials if m], mapping)
        side = side_of(obj, mapping)
        if zone_id is None:
            report.warn(f"{obj.name}: no coincide con ninguna zona; se exporta sin personalización")
            continue
        if side is None:
            if mapping.get("mirror"):
                side = "right"
            else:
                report.error(f"{obj.name}: no se pudo determinar el lado (right/left)")
                continue
        defaults = ZONE_DEFAULTS.get(zone_id, dict(material="leather", images=False))
        rule = mapping["zones"].get(zone_id, {})
        preset = rule.get("material", defaults["material"])

        if check_normals(obj, report):
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.normals_make_consistent(inside=False)
            bpy.ops.object.mode_set(mode="OBJECT")

        island = check_uvs(obj, report, require_island=defaults["images"])
        if island:
            islands[f"{side}:{zone_id}"] = island

        ensure_pbr_material(obj, preset, zone_id)
        optimize(obj, args.decimate, report)

        new_name = f"{'R' if side == 'right' else 'L'}_{ZONE_MESH_SUFFIX.get(zone_id, zone_id.title())}"
        if bpy.data.objects.get(new_name) and bpy.data.objects[new_name] is not obj:
            report.error(f"Nombre duplicado tras renombrar: {new_name}")
        obj.name = new_name
        obj.data.name = new_name
        zones_found.setdefault(zone_id, {})[side] = new_name

    # Espejo automático del zapato izquierdo si el asset solo trae el derecho
    if mapping.get("mirror"):
        for zone_id, sides in list(zones_found.items()):
            src = bpy.data.objects.get(sides.get("right", ""))
            if not src or "left" in sides:
                continue
            dup = src.copy()
            dup.data = src.data.copy()
            dup.name = src.name.replace("R_", "L_", 1)
            dup.data.name = dup.name
            dup.scale.z *= -1
            bpy.context.scene.collection.objects.link(dup)
            bpy.context.view_layer.objects.active = dup
            dup.select_set(True)
            bpy.ops.object.transform_apply(scale=True)
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.mesh.flip_normals()
            bpy.ops.object.mode_set(mode="OBJECT")
            zones_found[zone_id]["left"] = dup.name
            report.note(f"{zone_id}: izquierdo generado por espejo de {src.name}")

    # Nodos raíz Right / Left
    for side, label in (("right", "Right"), ("left", "Left")):
        root = bpy.data.objects.new(label, None)
        bpy.context.scene.collection.objects.link(root)
        roots[side] = root
        for zone_id, sides in zones_found.items():
            name = sides.get(side)
            if name and bpy.data.objects.get(name):
                bpy.data.objects[name].parent = root

    missing = [z for z in ZONE_DEFAULTS if z not in zones_found]
    for z in missing:
        (report.error if ZONE_DEFAULTS[z]["images"] else report.warn)(f"Zona sin malla: {z}")

    report.zones = {z: dict(meshes=s, islands={k.split(':')[0]: v for k, v in islands.items() if k.endswith(':' + z)}) for z, s in zones_found.items()}

    if args.strict and report.errors:
        report.error("Exportación abortada por errores (--strict)")
        report.write(args.report)
        sys.exit(1)

    export_glb(args.output, draco=args.draco)
    report.note(f"GLB exportado: {args.output}")

    if args.manifest:
        write_manifest(args, zones_found, islands, report)
    report.write(args.report)
    if report.errors:
        sys.exit(1)


def write_manifest(args, zones_found, islands, report: Report):
    model_id = os.path.splitext(os.path.basename(args.output))[0]
    url = "/" + os.path.relpath(args.output, "public").replace(os.sep, "/") if "public" in args.output else os.path.basename(args.output)
    manifest = {
        "modelId": model_id,
        "name": args.name or model_id,
        "version": 1,
        "provisional": False,
        "source": {"type": "glb", "url": url, "compression": ["draco"] if args.draco else []},
        "unitScale": 1,
        "shoes": {"right": {"nodeName": "Right", "label": "Derecho"}, "left": {"nodeName": "Left", "label": "Izquierdo"}},
        "layout": {"bothShoesGap": 0.3, "focusHeight": 0.42},
        "liningColor": "#d9d6d0",
        "zones": [],
    }
    for zone_id, sides in zones_found.items():
        d = ZONE_DEFAULTS.get(zone_id, dict(label=zone_id, material="leather", images=False))
        zone = {
            "id": zone_id,
            "label": d["label"],
            "meshNames": {"right": sides.get("right", ""), "left": sides.get("left", "")},
            "customizable": zone_id != "insole",
            "allowImages": d["images"],
            "allowText": d["images"],
            "allowColors": zone_id != "insole",
            "allowMaterials": d["images"] or zone_id == "midsole",
            "defaultColor": "#f2f1ee" if d["images"] else "#2b2b2e" if zone_id == "outsole" else "#f7f6f2",
            "material": d["material"],
            "lining": d["images"],
        }
        if d["images"]:
            island = islands.get(f"right:{zone_id}")
            w, h = 2048, 2048
            if island:
                ratio = (island["v1"] - island["v0"]) / max(1e-6, (island["u1"] - island["u0"]))
                h = int(max(256, min(2048, round(2048 * ratio / 8) * 8)))
                zone["uvIsland"] = island
            zone["texture"] = {"width": w, "height": h}
        manifest["zones"].append(zone)
    os.makedirs(os.path.dirname(os.path.abspath(args.manifest)), exist_ok=True)
    with open(args.manifest, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    report.note(f"Manifiesto escrito: {args.manifest} (revisa texture.width/height y uvIsland)")


def parse_args(argv):
    p = argparse.ArgumentParser(description="SneakerLab Blender pipeline")
    p.add_argument("--input", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--mapping", required=True)
    p.add_argument("--manifest")
    p.add_argument("--name")
    p.add_argument("--report")
    p.add_argument("--decimate", type=float)
    p.add_argument("--draco", action="store_true")
    p.add_argument("--strict", action="store_true")
    return p.parse_args(argv)


if __name__ == "__main__":
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    if bpy is None:
        print("Este script debe ejecutarse dentro de Blender: blender -b --python ... -- <args>")
        sys.exit(2)
    run(parse_args(argv))

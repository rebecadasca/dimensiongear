import bpy
import json
import math
import os
import sys
from mathutils import Vector


def args_after_separator():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1:]


def world_bounds(objects):
    points = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    maximum = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return minimum, maximum


def look_at(camera, target):
    direction = target - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def make_material(name, color, metallic=0.0, roughness=0.72):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1.0)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return material


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def render_view(output_path, meshes, center, size, direction):
    camera = bpy.data.objects.get("AuditCamera")
    max_dimension = max(size.x, size.y, size.z)
    if direction == "front":
        camera.location = center + Vector((0, -max_dimension * 2.4, size.z * 0.08))
    elif direction == "back":
        camera.location = center + Vector((0, max_dimension * 2.4, size.z * 0.08))
    elif direction == "left":
        camera.location = center + Vector((-max_dimension * 2.4, 0, size.z * 0.08))
    else:
        camera.location = center + Vector((max_dimension * 2.4, 0, size.z * 0.08))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(size.x, size.z) * 1.18 if direction in {"front", "back"} else max(size.y, size.z) * 1.18
    look_at(camera, center)
    bpy.context.scene.render.filepath = output_path
    bpy.ops.render.render(write_still=True)


arguments = args_after_separator()
if len(arguments) != 2:
    raise SystemExit("Usage: blender --background --python audit_vortex.py -- input.glb output_dir")

input_path = os.path.abspath(arguments[0])
output_dir = os.path.abspath(arguments[1])
os.makedirs(output_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path, merge_vertices=False)

meshes = sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), key=lambda obj: obj.name)
minimum, maximum = world_bounds(meshes)
center = (minimum + maximum) / 2
size = maximum - minimum

audit = []
for obj in meshes:
    obj_min, obj_max = world_bounds([obj])
    audit.append({
        "name": obj.name,
        "parent": obj.parent.name if obj.parent else None,
        "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        "vertices": len(obj.data.vertices),
        "polygons": len(obj.data.polygons),
        "center": list(((obj_min + obj_max) / 2)[:]),
        "size": list((obj_max - obj_min)[:]),
    })

with open(os.path.join(output_dir, "mesh-audit.json"), "w", encoding="utf-8") as handle:
    json.dump({"bounds": {"min": list(minimum[:]), "max": list(maximum[:])}, "meshes": audit}, handle, indent=2)

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("AuditWorld")
scene.world.color = (0.018, 0.025, 0.021)

camera_data = bpy.data.cameras.new("AuditCamera")
camera = bpy.data.objects.new("AuditCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

key_data = bpy.data.lights.new("Key", "AREA")
key_data.energy = 1800
key_data.shape = "DISK"
key_data.size = max(size.x, size.z) * 0.8
key = bpy.data.objects.new("Key", key_data)
key.location = center + Vector((-size.x, -size.y * 1.8, size.z * 1.2))
scene.collection.objects.link(key)
look_at(key, center)

fill_data = bpy.data.lights.new("Fill", "AREA")
fill_data.energy = 900
fill_data.size = max(size.x, size.z)
fill = bpy.data.objects.new("Fill", fill_data)
fill.location = center + Vector((size.x * 1.2, -size.y, size.z * 0.6))
scene.collection.objects.link(fill)
look_at(fill, center)

dark = make_material("AUDIT_FIXED", (0.055, 0.07, 0.065), metallic=0.05, roughness=0.62)
highlight = make_material("AUDIT_HIGHLIGHT", (0.95, 0.04, 0.015), metallic=0.0, roughness=0.38)

for obj in meshes:
    assign_material(obj, dark)

for view in ("front", "back", "left", "right"):
    render_view(os.path.join(output_dir, f"overview-{view}.png"), meshes, center, size, view)

skin_objects = [obj for obj in meshes if any("black_skin" in material for material in next(item["materials"] for item in audit if item["name"] == obj.name))]
for index, obj in enumerate(skin_objects, start=1):
    assign_material(obj, highlight)
    safe_name = obj.name.replace(".", "_")
    for view in ("front", "left"):
        render_view(os.path.join(output_dir, f"skin-{index:02d}-{safe_name}-{view}.png"), meshes, center, size, view)
    assign_material(obj, dark)

outline_objects = [obj for obj in meshes if any("outline" in material for material in next(item["materials"] for item in audit if item["name"] == obj.name))]
for index, obj in enumerate(outline_objects, start=1):
    assign_material(obj, highlight)
    safe_name = obj.name.replace(".", "_")
    render_view(os.path.join(output_dir, f"outline-{index:02d}-{safe_name}-front.png"), meshes, center, size, "front")
    assign_material(obj, dark)

print(json.dumps({"mesh_count": len(meshes), "skin_meshes": [obj.name for obj in skin_objects], "outline_meshes": [obj.name for obj in outline_objects], "output_dir": output_dir}))

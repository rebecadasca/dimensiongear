import bpy
import json
import os
import sys
from mathutils import Vector


PALETTE = [
    (0.96, 0.16, 0.32),
    (0.08, 0.88, 0.42),
    (0.10, 0.52, 1.00),
    (1.00, 0.72, 0.08),
    (0.72, 0.20, 0.95),
    (0.10, 0.90, 0.90),
    (1.00, 0.36, 0.08),
    (0.96, 0.96, 0.96),
    (1.00, 0.20, 0.72),
    (0.42, 1.00, 0.16),
    (0.68, 0.52, 1.00),
]


def arguments():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1.0)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.48
    return result


def render_view(path, camera, center, size, direction):
    span = max(size.x, size.y, size.z)
    offsets = {
        "front": Vector((0, -span * 2.5, size.z * 0.05)),
        "back": Vector((0, span * 2.5, size.z * 0.05)),
        "left": Vector((-span * 2.5, 0, size.z * 0.05)),
        "right": Vector((span * 2.5, 0, size.z * 0.05)),
    }
    camera.location = center + offsets[direction]
    camera.data.type = "ORTHO"
    camera.data.clip_end = span * 10
    camera.data.ortho_scale = max(size.x, size.z) * 1.16 if direction in {"front", "back"} else max(size.y, size.z) * 1.16
    look_at(camera, center)
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


args = arguments()
if len(args) != 2:
    raise SystemExit("Usage: blender --background --python audit_skullcandy.py -- input.glb output_dir")

input_path, output_dir = map(os.path.abspath, args)
os.makedirs(output_dir, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path, merge_vertices=False)
for image_index, source_image in enumerate(bpy.data.images):
    if source_image.type == "IMAGE" and source_image.size[0] > 0:
        source_image.file_format = "PNG"
        source_image.filepath_raw = os.path.join(output_dir, f"source-texture-{image_index:02d}.png")
        source_image.save()
source = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")

bpy.context.view_layer.objects.active = source
source.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

parts = sorted(
    (obj for obj in bpy.context.selected_objects if obj.type == "MESH"),
    key=lambda obj: (-len(obj.data.polygons), obj.name),
)
for index, obj in enumerate(parts):
    obj.name = f"SKULL_PART_{index:02d}"
    obj.data.name = obj.name
    obj.data.materials.clear()
    obj.data.materials.append(material(f"AUDIT_PART_{index:02d}", PALETTE[index % len(PALETTE)]))

minimum, maximum = world_bounds(parts)
center, size = (minimum + maximum) / 2, maximum - minimum

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.world = bpy.data.worlds.new("AuditWorld")
scene.world.color = (0.008, 0.012, 0.010)

camera_data = bpy.data.cameras.new("AuditCamera")
camera = bpy.data.objects.new("AuditCamera", camera_data)
scene.collection.objects.link(camera)
scene.camera = camera

for name, energy, offset, scale in (
    ("Key", 1800, Vector((-size.x, -size.y * 1.5, size.z * 1.2)), 0.9),
    ("Fill", 1100, Vector((size.x, -size.y, size.z * 0.5)), 1.2),
):
    light_data = bpy.data.lights.new(name, "AREA")
    light_data.energy = energy
    light_data.shape = "DISK"
    light_data.size = max(size.x, size.z) * scale
    light = bpy.data.objects.new(name, light_data)
    light.location = center + offset
    scene.collection.objects.link(light)
    look_at(light, center)

audit = []
for index, obj in enumerate(parts):
    part_min, part_max = world_bounds([obj])
    audit.append({
        "index": index,
        "name": obj.name,
        "polygons": len(obj.data.polygons),
        "vertices": len(obj.data.vertices),
        "center": list(((part_min + part_max) / 2)[:]),
        "size": list((part_max - part_min)[:]),
    })

with open(os.path.join(output_dir, "parts.json"), "w", encoding="utf-8") as handle:
    json.dump({"bounds": {"min": list(minimum[:]), "max": list(maximum[:])}, "parts": audit}, handle, indent=2)

for view in ("front", "back", "left", "right"):
    render_view(os.path.join(output_dir, f"parts-{view}.png"), camera, center, size, view)

print(json.dumps({"output_dir": output_dir, "parts": len(parts), "polygons": sum(len(obj.data.polygons) for obj in parts)}))

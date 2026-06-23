import bpy
import json
import math
import os
import sys
from mathutils import Vector


MATERIALS = {
    "base-frame": (0.055, 0.055, 0.065, 1.0),
    "audio-cups": (0.055, 0.055, 0.065, 1.0),
    "ear-cushions": (0.04, 0.04, 0.045, 1.0),
    "headband-cushion": (0.04, 0.04, 0.045, 1.0),
}
MATERIAL_NAMES = {
    "base-frame": "SKULL_BASE_FRAME",
    "audio-cups": "SKULL_AUDIO_CUPS",
    "ear-cushions": "SKULL_EAR_CUSHIONS",
    "headband-cushion": "SKULL_HEADBAND_CUSHION",
}
AUDIT_COLORS = {
    "base-frame": (1.0, 0.03, 0.52, 1.0),
    "audio-cups": (0.12, 1.0, 0.24, 1.0),
    "ear-cushions": (1.0, 0.92, 0.02, 1.0),
    "headband-cushion": (1.0, 0.31, 0.015, 1.0),
}


def args_after_separator():
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def ensure_directory(path):
    os.makedirs(path, exist_ok=True)


def world_bounds(objects):
    points = [obj.matrix_world @ Vector(corner) for obj in objects for corner in obj.bound_box]
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def linked_image(material, input_name):
    if not material.use_nodes:
        return None
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not bsdf or input_name not in bsdf.inputs:
        return None
    pending = [link.from_node for link in bsdf.inputs[input_name].links]
    visited = set()
    while pending:
        node = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        if node.type == "TEX_IMAGE" and node.image:
            return node.image
        pending.extend(link.from_node for socket in node.inputs for link in socket.links)
    return None


def save_image(name, path, width, height, pixels, non_color=False):
    image = bpy.data.images.new(name, width=width, height=height, alpha=False)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels)
    image.update()
    image.file_format = "PNG"
    image.filepath_raw = path
    image.save()
    return image


def build_neutral_albedo_and_logo(source, texture_dir):
    width, height = source.size
    source_pixels = list(source.pixels[:])
    neutral = [0.0] * (width * height * 4)
    logo = [0.0] * (width * height * 4)
    logo_pixels = 0
    for y in range(height):
        v = y / max(1, height - 1)
        for x in range(width):
            u = x / max(1, width - 1)
            offset = (y * width + x) * 4
            r, g, b, a = source_pixels[offset : offset + 4]
            luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
            edge = max(0.0, min(1.0, (luminance - 0.0025) / 0.0195))
            edge = edge * edge * (3.0 - 2.0 * edge)
            detail = 0.46 + edge * 0.54
            neutral[offset : offset + 4] = [detail, detail, detail, a]

            in_logo_atlas = 0.64 <= u <= 0.77 and 0.035 <= v <= 0.18
            mask = 1.0 if in_logo_atlas and luminance >= 0.12 else 0.0
            if mask:
                logo_pixels += 1
            logo[offset : offset + 4] = [mask, mask, mask, 1.0]

    neutral_image = save_image(
        "SKULL_NEUTRAL_ALBEDO",
        os.path.join(texture_dir, "neutral-albedo.png"),
        width,
        height,
        neutral,
    )
    save_image(
        "SKULL_LOGO_MASK",
        os.path.join(texture_dir, "logo-mask.png"),
        width,
        height,
        logo,
        non_color=True,
    )
    return neutral_image, logo_pixels


def replace_base_color_image(material, neutral_image):
    bsdf = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if not bsdf:
        return
    pending = [link.from_node for link in bsdf.inputs["Base Color"].links]
    visited = set()
    while pending:
        node = pending.pop()
        if node in visited:
            continue
        visited.add(node)
        if node.type == "TEX_IMAGE":
            node.image = neutral_image
            return
        pending.extend(link.from_node for socket in node.inputs for link in socket.links)


def make_material(source, group, neutral_image):
    result = source.copy()
    result.name = MATERIAL_NAMES[group]
    result.diffuse_color = MATERIALS[group]
    replace_base_color_image(result, neutral_image)
    bsdf = next((node for node in result.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs["Base Color"].default_value = (1.0, 1.0, 1.0, 1.0)
    return result


def headband_group(poly, uv_layer):
    uv_points = [uv_layer.data[loop_index].uv for loop_index in poly.loop_indices]
    u = sum(point.x for point in uv_points) / len(uv_points)
    v = sum(point.y for point in uv_points) / len(uv_points)
    # The padded underside owns the long upper-left UV island. The rule is saved
    # in the face manifest so this split remains inspectable and reproducible.
    return "headband-cushion" if u <= 0.45 and 0.38 <= v <= 0.62 else "base-frame"


def audio_cup_group(poly, uv_layer):
    uv_points = [uv_layer.data[loop_index].uv for loop_index in poly.loop_indices]
    u = sum(point.x for point in uv_points) / len(uv_points)
    v = sum(point.y for point in uv_points) / len(uv_points)
    return "ear-cushions" if u <= 0.45 and v >= 0.62 else "audio-cups"


def audit_material(name, color):
    result = bpy.data.materials.new(name)
    result.diffuse_color = color
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = 0.5
    return result


def render_audit(scene, objects, output_dir):
    audit_materials = {
        group: audit_material(f"AUDIT_{MATERIAL_NAMES[group]}", color)
        for group, color in AUDIT_COLORS.items()
    }
    for obj in objects:
        groups = obj.get("skull_groups", [])
        obj.data.materials.clear()
        for group in groups:
            obj.data.materials.append(audit_materials[group])

    minimum, maximum = world_bounds(objects)
    center, size = (minimum + maximum) / 2, maximum - minimum
    span = max(size.x, size.y, size.z)
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 900
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"
    world = bpy.data.worlds.new("SKULL_AUDIT_WORLD")
    world.color = (0.008, 0.012, 0.01)
    scene.world = world

    camera_data = bpy.data.cameras.new("SKULL_AUDIT_CAMERA")
    camera_data.type = "ORTHO"
    camera_data.clip_end = span * 10
    camera = bpy.data.objects.new("SKULL_AUDIT_CAMERA", camera_data)
    scene.collection.objects.link(camera)
    scene.camera = camera

    for name, energy, offset in (
        ("SKULL_AUDIT_KEY", 1900, Vector((-size.x, -size.y * 1.5, size.z * 1.2))),
        ("SKULL_AUDIT_FILL", 1200, Vector((size.x, -size.y, size.z * 0.45))),
    ):
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.size = span
        light = bpy.data.objects.new(name, light_data)
        light.location = center + offset
        scene.collection.objects.link(light)
        look_at(light, center)

    views = {
        "front": Vector((0, -span * 2.5, size.z * 0.05)),
        "back": Vector((0, span * 2.5, size.z * 0.05)),
        "left": Vector((-span * 2.5, 0, size.z * 0.05)),
        "right": Vector((span * 2.5, 0, size.z * 0.05)),
    }
    for name, offset in views.items():
        camera.location = center + offset
        camera.data.ortho_scale = (
            max(size.x, size.z) if name in {"front", "back"} else max(size.y, size.z)
        ) * 1.16
        look_at(camera, center)
        scene.render.filepath = os.path.join(output_dir, f"skullcandy-{name}.png")
        bpy.ops.render.render(write_still=True)


arguments = args_after_separator()
if len(arguments) != 5:
    raise SystemExit(
        "Usage: blender --background --python prepare_skullcandy_crusher.py -- input.glb output.glb texture_dir audit_dir source.blend"
    )

input_path, output_glb, texture_dir, audit_dir, blend_path = map(os.path.abspath, arguments)
ensure_directory(os.path.dirname(output_glb))
ensure_directory(texture_dir)
ensure_directory(audit_dir)
ensure_directory(os.path.dirname(blend_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path, merge_vertices=False)
source = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
source_material = source.data.materials[0]
base_color_image = linked_image(source_material, "Base Color")
if not base_color_image:
    raise RuntimeError("The source model has no linked base-color image")
neutral_image, logo_pixels = build_neutral_albedo_and_logo(base_color_image, texture_dir)
materials = {
    group: make_material(source_material, group, neutral_image)
    for group in MATERIALS
}

bpy.context.view_layer.objects.active = source
source.select_set(True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=0.00001)
bpy.ops.object.mode_set(mode="OBJECT")

source_index = source.data.attributes.new("source_polygon", "INT", "FACE")
for index, item in enumerate(source_index.data):
    item.value = index
source_triangle_count = len(source.data.polygons)

bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

parts = sorted(
    (obj for obj in bpy.context.selected_objects if obj.type == "MESH"),
    key=lambda obj: (-len(obj.data.polygons), obj.name),
)
face_groups = {group: [] for group in MATERIALS}
for part_index, obj in enumerate(parts):
    obj.name = f"SKULL_PART_{part_index:02d}"
    obj.data.name = obj.name
    if part_index in {0, 1}:
        default_group = "audio-cups"
    elif part_index in {2, 3}:
        default_group = "base-frame"
    else:
        default_group = "base-frame"

    groups = ["audio-cups", "ear-cushions"] if part_index in {0, 1} else [default_group]
    if part_index == 4:
        groups = ["base-frame", "headband-cushion"]
    obj["skull_groups"] = groups
    obj.data.materials.clear()
    for group in groups:
        obj.data.materials.append(materials[group])

    uv_layer = obj.data.uv_layers.active
    source_attribute = obj.data.attributes["source_polygon"]
    for polygon_index, poly in enumerate(obj.data.polygons):
        group = (
            headband_group(poly, uv_layer)
            if part_index == 4
            else audio_cup_group(poly, uv_layer)
            if part_index in {0, 1}
            else default_group
        )
        poly.material_index = groups.index(group)
        face_groups[group].append(source_attribute.data[polygon_index].value)

assigned = [face for faces in face_groups.values() for face in faces]
if len(assigned) != source_triangle_count or len(set(assigned)) != source_triangle_count:
    raise RuntimeError("Face audit failed: polygons are missing or assigned more than once")

output_objects = [obj for obj in parts]
bpy.ops.object.select_all(action="DESELECT")
for obj in output_objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = output_objects[0]
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_attributes=False,
)

manifest = {
    "source": os.path.relpath(input_path, os.path.dirname(output_glb)).replace("\\", "/"),
    "sourceTriangleCount": source_triangle_count,
    "exportedTriangleCount": sum(len(obj.data.polygons) for obj in output_objects),
    "logoMaskPixels": logo_pixels,
    "materials": MATERIAL_NAMES,
    "groups": {group: sorted(faces) for group, faces in face_groups.items()},
}
with open(os.path.join(os.path.dirname(output_glb), "skullcandy-crusher-face-groups.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)

bpy.ops.wm.save_as_mainfile(filepath=blend_path)
render_audit(bpy.context.scene, output_objects, audit_dir)
print(json.dumps({
    "output": output_glb,
    "triangles": source_triangle_count,
    "groups": {group: len(faces) for group, faces in face_groups.items()},
    "logoMaskPixels": logo_pixels,
}))

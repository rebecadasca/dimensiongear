import bpy
import json
import math
import os
import sys
from mathutils import Vector


TEXTURE_SIZE = 512


MATERIAL_PRESETS = {
    "black": {
        "color": (0.045, 0.049, 0.056),
        "roughness": 0.2,
        "normal_strength": 0.075,
    },
    "grey": {
        "color": (0.36, 0.38, 0.4),
        "roughness": 0.24,
        "normal_strength": 0.06,
    },
    "green": {
        "color": (0.025, 0.68, 0.34),
        "roughness": 0.18,
        "normal_strength": 0.055,
    },
    "grill1": {
        "color": (0.055, 0.068, 0.062),
        "roughness": 0.2,
        "normal_strength": 0.05,
    },
    "grill2": {
        "color": (0.02, 0.95, 0.45),
        "roughness": 0.16,
        "normal_strength": 0.035,
        "emissive": 0.75,
    },
}


def args_after_separator():
    if "--" not in sys.argv:
        return []
    return sys.argv[sys.argv.index("--") + 1 :]


def ensure_directory(path):
    os.makedirs(path, exist_ok=True)


def world_bounds(objects):
    points = []
    for obj in objects:
        points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    minimum = Vector(tuple(min(point[index] for point in points) for index in range(3)))
    maximum = Vector(tuple(max(point[index] for point in points) for index in range(3)))
    return minimum, maximum


def look_at(obj, target):
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def save_rgba_image(name, path, pixels, non_color=False):
    previous = bpy.data.images.get(name)
    if previous:
        bpy.data.images.remove(previous)
    image = bpy.data.images.new(name, width=TEXTURE_SIZE, height=TEXTURE_SIZE, alpha=False)
    if non_color:
        image.colorspace_settings.name = "Non-Color"
    image.pixels.foreach_set(pixels)
    image.file_format = "PNG"
    image.filepath_raw = path
    image.save()
    return image


def build_plastic_maps(texture_dir):
    ensure_directory(texture_dir)
    size = TEXTURE_SIZE
    tau = math.tau
    height = [0.0] * (size * size)
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            broad = 0.45 * math.sin(tau * (1.7 * u + 0.9 * v))
            flow = 0.28 * math.sin(tau * (7.0 * u - 1.8 * v + 0.21))
            fine = 0.08 * math.sin(tau * 58.0 * (u + 0.12 * math.sin(tau * v)))
            scratches = 0.0
            for index in range(5):
                phase = index * 0.173
                line = abs(math.sin(tau * (v * (18 + index * 4) + u * 0.36 + phase)))
                scratches += math.exp(-120.0 * line * line) * 0.015
            value = 0.5 + 0.018 * broad + 0.012 * flow + 0.004 * fine + scratches
            height[y * size + x] = max(0.0, min(1.0, value))

    normal_pixels = [0.0] * (size * size * 4)
    roughness_pixels = [0.0] * (size * size * 4)
    for y in range(size):
        up = ((y + 1) % size) * size
        down = ((y - 1) % size) * size
        row = y * size
        for x in range(size):
            left = row + ((x - 1) % size)
            right = row + ((x + 1) % size)
            current = height[row + x]
            dx = (height[right] - height[left]) * 11.0
            dy = (height[up + x] - height[down + x]) * 11.0
            length = math.sqrt(dx * dx + dy * dy + 1.0)
            nx, ny, nz = -dx / length, -dy / length, 1.0 / length
            satin_variation = 0.035 * math.sin(tau * (5.5 * x / size + 1.2 * y / size))
            roughness = max(0.12, min(0.34, 0.21 + satin_variation + (0.5 - current) * 0.55))
            offset = (row + x) * 4
            normal_pixels[offset : offset + 4] = [
                nx * 0.5 + 0.5,
                ny * 0.5 + 0.5,
                nz * 0.5 + 0.5,
                1.0,
            ]
            roughness_pixels[offset : offset + 4] = [roughness, roughness, roughness, 1.0]

    return {
        "normal": save_rgba_image(
            "DG_MOUSE_GLOSSY_NORMAL",
            os.path.join(texture_dir, "normal.png"),
            normal_pixels,
            non_color=True,
        ),
        "roughness": save_rgba_image(
            "DG_MOUSE_GLOSSY_ROUGHNESS",
            os.path.join(texture_dir, "roughness.png"),
            roughness_pixels,
            non_color=True,
        ),
    }


def set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def configure_glossy_material(name, preset, images):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.name = name
    material.use_nodes = True
    material.diffuse_color = (*preset["color"], 1.0)

    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (620, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (330, 0)
    set_input(bsdf, ("Base Color",), (*preset["color"], 1.0))
    set_input(bsdf, ("Metallic",), 0.0)
    set_input(bsdf, ("Roughness",), preset["roughness"])
    set_input(bsdf, ("Alpha",), 1.0)
    set_input(bsdf, ("Coat Weight", "Clearcoat",), 0.42)
    set_input(bsdf, ("Coat Roughness", "Clearcoat Roughness",), 0.18)
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name = "DG_MOUSE_ROUGHNESS"
    roughness_node.image = images["roughness"]
    roughness_node.image.colorspace_settings.name = "Non-Color"
    roughness_node.location = (-420, -40)
    links.new(roughness_node.outputs["Color"], bsdf.inputs["Roughness"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "DG_MOUSE_NORMAL"
    normal_node.image = images["normal"]
    normal_node.image.colorspace_settings.name = "Non-Color"
    normal_node.location = (-420, -250)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (45, -200)
    normal_map.inputs["Strength"].default_value = preset["normal_strength"]
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])

    emissive_strength = preset.get("emissive")
    if emissive_strength is not None:
        set_input(bsdf, ("Emission Color",), (*preset["color"], 1.0))
        set_input(bsdf, ("Emission Strength",), emissive_strength)

    return material


def configure_studio(scene, meshes, preview_path):
    minimum, maximum = world_bounds(meshes)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    max_dimension = max(size.x, size.y, size.z)

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 960
    scene.render.resolution_y = 720
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("DG_MOUSE_STUDIO_WORLD")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.026, 0.029, 0.032, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.42
    scene.world = world

    camera_data = bpy.data.cameras.new("DG_MOUSE_PREVIEW_CAMERA")
    camera = bpy.data.objects.new("DG_MOUSE_PREVIEW_CAMERA", camera_data)
    scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(size.x, size.y) * 1.42
    camera.location = center + Vector((max_dimension * 0.72, -max_dimension * 1.32, max_dimension * 0.68))
    look_at(camera, center)
    scene.camera = camera

    lights = (
        ("DG_MOUSE_KEY", 4200, (-0.6, -1.2, 1.25), 0.95),
        ("DG_MOUSE_STRIP", 2600, (1.2, -0.2, 0.72), 0.58),
        ("DG_MOUSE_RIM", 1800, (-1.0, 0.8, 0.95), 0.75),
    )
    for name, energy, direction, scale in lights:
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "RECTANGLE"
        light_data.size = max_dimension * scale
        light_data.size_y = max_dimension * scale * 0.16
        light = bpy.data.objects.new(name, light_data)
        light.location = center + Vector(tuple(max_dimension * value for value in direction))
        scene.collection.objects.link(light)
        look_at(light, center)

    scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)


arguments = args_after_separator()
if len(arguments) != 5:
    raise SystemExit(
        "Usage: blender --background --python prepare_aether_mouse.py -- input.glb output.glb texture_dir preview.png source.blend"
    )

input_path, output_glb, texture_dir, preview_path, blend_path = map(os.path.abspath, arguments)
ensure_directory(os.path.dirname(output_glb))
ensure_directory(texture_dir)
ensure_directory(os.path.dirname(preview_path))
ensure_directory(os.path.dirname(blend_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path, merge_vertices=False)

for obj in list(bpy.context.scene.objects):
    if obj.type == "MESH" and obj.name == "Cube":
        bpy.data.objects.remove(obj, do_unlink=True)

meshes = sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), key=lambda obj: obj.name)
minimum, maximum = world_bounds(meshes)
center = (minimum + maximum) / 2
for obj in meshes:
    obj.location -= center

images = build_plastic_maps(texture_dir)
for name, preset in MATERIAL_PRESETS.items():
    configure_glossy_material(name, preset, images)

manifest = {
    "materials": sorted(MATERIAL_PRESETS.keys()),
    "meshes": [
        {
            "name": obj.name,
            "materials": [slot.material.name for slot in obj.material_slots if slot.material],
        }
        for obj in meshes
    ],
}
with open(os.path.join(os.path.dirname(output_glb), "aether-m9-glossy-manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)

bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_attributes=True,
)

configure_studio(bpy.context.scene, meshes, preview_path)
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

print(
    json.dumps(
        {
            "output_glb": output_glb,
            "texture_dir": texture_dir,
            "preview_path": preview_path,
            "blend_path": blend_path,
            "manifest": manifest,
        }
    )
)

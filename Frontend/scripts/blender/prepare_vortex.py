import bpy
import json
import math
import os
import sys
from mathutils import Vector


SEMANTIC_GROUPS = {
    "seat": {
        "Object_5": "CHAIR_SEAT_FRONT",
        "Object_8": "CHAIR_SEAT_MAIN",
    },
    "backrest": {
        "Object_51": "CHAIR_BACK_MAIN",
    },
    "pillow": {
        "Object_11": "CHAIR_PILLOW_LUMBAR",
        "Object_54": "CHAIR_PILLOW_HEAD_MAIN",
        "Object_75": "CHAIR_PILLOW_HEAD_DETAIL",
    },
    "accent": {
        "Object_6": "CHAIR_ACCENT_SEAT_CENTER_STRIPE",
        "Object_9": "CHAIR_ACCENT_SEAT_TRIM",
        "Object_52": "CHAIR_ACCENT_BACK_OUTER_TRIM",
        "Object_73": "CHAIR_ACCENT_LUMBAR_STRIPES",
        "Object_77": "CHAIR_ACCENT_HEAD_PILLOW_STRIPES",
        "Object_79": "CHAIR_ACCENT_LOGO",
    },
}

TEXTURE_SIZE = 512


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


def create_simple_material(name, color, roughness, metallic=0.0):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return material


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


def build_height_field(surface):
    size = TEXTURE_SIZE
    field = [0.0] * (size * size)
    tau = math.tau
    for y in range(size):
        v = y / size
        for x in range(size):
            u = x / size
            if surface == "leather":
                broad = (
                    math.sin(tau * (7.0 * u + 3.0 * v))
                    + 0.62 * math.sin(tau * (13.0 * u - 9.0 * v + 0.17))
                    + 0.35 * math.sin(tau * (31.0 * u + 17.0 * v + 0.41))
                )
                pores = abs(math.sin(tau * (43.0 * u + 11.0 * v))) * abs(
                    math.sin(tau * (37.0 * v - 7.0 * u))
                )
                value = 0.50 + 0.055 * broad - 0.065 * (pores**8)
            elif surface == "textile":
                warp_phase = math.sin(tau * 34.0 * u)
                weft_phase = math.sin(tau * 34.0 * v)
                warp = math.exp(-9.0 * warp_phase * warp_phase)
                weft = math.exp(-9.0 * weft_phase * weft_phase)
                alternating = math.sin(tau * 17.0 * u) * math.sin(tau * 17.0 * v)
                value = 0.34 + 0.30 * warp + 0.25 * weft + 0.05 * alternating
            else:
                diagonal_a = abs(math.sin(math.pi * 23.0 * (u + v)))
                diagonal_b = abs(math.sin(math.pi * 23.0 * (u - v)))
                strand_a = math.exp(-19.0 * diagonal_a * diagonal_a)
                strand_b = math.exp(-19.0 * diagonal_b * diagonal_b)
                fine = 0.04 * math.sin(tau * 46.0 * u) * math.sin(tau * 46.0 * v)
                value = 0.18 + 0.47 * max(strand_a, strand_b) + fine
            field[y * size + x] = max(0.0, min(1.0, value))
    return field


def surface_pixels(surface, height):
    size = TEXTURE_SIZE
    base_pixels = [0.0] * (size * size * 4)
    roughness_pixels = [0.0] * (size * size * 4)
    normal_pixels = [0.0] * (size * size * 4)
    strengths = {"leather": 4.2, "textile": 6.5, "mesh": 8.5}
    roughness_base = {"leather": 0.48, "textile": 0.78, "mesh": 0.67}

    for y in range(size):
        up = ((y + 1) % size) * size
        down = ((y - 1) % size) * size
        row = y * size
        for x in range(size):
            left = row + ((x - 1) % size)
            right = row + ((x + 1) % size)
            current = height[row + x]
            dx = (height[right] - height[left]) * strengths[surface]
            dy = (height[up + x] - height[down + x]) * strengths[surface]
            length = math.sqrt(dx * dx + dy * dy + 1.0)
            nx, ny, nz = -dx / length, -dy / length, 1.0 / length

            if surface == "leather":
                shade = 0.84 + (current - 0.5) * 0.22
            elif surface == "textile":
                shade = 0.80 + (current - 0.5) * 0.30
            else:
                shade = 0.48 + current * 0.55
            roughness = max(
                0.18,
                min(0.95, roughness_base[surface] + (0.5 - current) * 0.18),
            )
            offset = (row + x) * 4
            base_pixels[offset : offset + 4] = [shade, shade, shade, 1.0]
            roughness_pixels[offset : offset + 4] = [roughness, roughness, roughness, 1.0]
            normal_pixels[offset : offset + 4] = [
                nx * 0.5 + 0.5,
                ny * 0.5 + 0.5,
                nz * 0.5 + 0.5,
                1.0,
            ]
    return base_pixels, roughness_pixels, normal_pixels


def generate_surface_textures(texture_dir):
    images = {}
    for surface in ("leather", "textile", "mesh"):
        surface_dir = os.path.join(texture_dir, surface)
        ensure_directory(surface_dir)
        height = build_height_field(surface)
        base, roughness, normal = surface_pixels(surface, height)
        images[surface] = {
            "basecolor": save_rgba_image(
                f"DG_{surface}_basecolor",
                os.path.join(surface_dir, "basecolor.png"),
                base,
            ),
            "roughness": save_rgba_image(
                f"DG_{surface}_roughness",
                os.path.join(surface_dir, "roughness.png"),
                roughness,
                non_color=True,
            ),
            "normal": save_rgba_image(
                f"DG_{surface}_normal",
                os.path.join(surface_dir, "normal.png"),
                normal,
                non_color=True,
            ),
        }
    return images


def create_surface_material(surface, images):
    material = bpy.data.materials.get(f"DG_UPHOLSTERY_{surface.upper()}") or bpy.data.materials.new(
        f"DG_UPHOLSTERY_{surface.upper()}"
    )
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (620, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (340, 0)
    bsdf.inputs["Metallic"].default_value = 0.0
    bsdf.inputs["IOR"].default_value = 1.46
    links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])

    base_node = nodes.new("ShaderNodeTexImage")
    base_node.name = "DG_BASECOLOR"
    base_node.image = images[surface]["basecolor"]
    base_node.location = (-420, 170)
    links.new(base_node.outputs["Color"], bsdf.inputs["Base Color"])

    roughness_node = nodes.new("ShaderNodeTexImage")
    roughness_node.name = "DG_ROUGHNESS"
    roughness_node.image = images[surface]["roughness"]
    roughness_node.image.colorspace_settings.name = "Non-Color"
    roughness_node.location = (-420, -40)
    links.new(roughness_node.outputs["Color"], bsdf.inputs["Roughness"])

    normal_node = nodes.new("ShaderNodeTexImage")
    normal_node.name = "DG_NORMAL"
    normal_node.image = images[surface]["normal"]
    normal_node.image.colorspace_settings.name = "Non-Color"
    normal_node.location = (-420, -250)
    normal_map = nodes.new("ShaderNodeNormalMap")
    normal_map.location = (70, -190)
    normal_map.inputs["Strength"].default_value = {"leather": 0.72, "textile": 0.9, "mesh": 1.15}[surface]
    links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def assign_material(obj, material):
    obj.data.materials.clear()
    obj.data.materials.append(material)


def configure_semantic_meshes(meshes, surface_material, accent_material, fixed_plastic, fixed_metal):
    by_original_name = {obj.name: obj for obj in meshes}
    grouped_names = set()
    semantic_objects = {"seat": [], "backrest": [], "pillow": [], "accent": [], "fixed": []}

    for group, mapping in SEMANTIC_GROUPS.items():
        for original_name, semantic_name in mapping.items():
            obj = by_original_name.get(original_name)
            if not obj:
                raise RuntimeError(f"Required mesh {original_name} was not found")
            grouped_names.add(original_name)
            obj.name = semantic_name
            obj.data.name = semantic_name
            assign_material(obj, accent_material if group == "accent" else surface_material)
            obj["configurator_group"] = group
            obj["configurator_editable"] = True
            semantic_objects[group].append(obj)

    for original_name, obj in by_original_name.items():
        if original_name in grouped_names:
            continue
        original_materials = [slot.material.name.lower() for slot in obj.material_slots if slot.material]
        assign_material(obj, fixed_metal if any("metal" in name for name in original_materials) else fixed_plastic)
        obj.name = f"FIXED_{original_name}"
        obj.data.name = obj.name
        obj["configurator_group"] = "fixed"
        obj["configurator_editable"] = False
        semantic_objects["fixed"].append(obj)
    return semantic_objects


def configure_studio(scene, meshes, preview_dir):
    minimum, maximum = world_bounds(meshes)
    center = (minimum + maximum) / 2
    size = maximum - minimum
    max_dimension = max(size.x, size.y, size.z)

    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 840
    scene.render.resolution_y = 840
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"

    world = bpy.data.worlds.new("DG_STUDIO_WORLD")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.008, 0.012, 0.011, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.28
    scene.world = world

    camera_data = bpy.data.cameras.new("DG_PREVIEW_CAMERA")
    camera = bpy.data.objects.new("DG_PREVIEW_CAMERA", camera_data)
    scene.collection.objects.link(camera)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(size.x, size.z) * 1.14
    camera.location = center + Vector((max_dimension * 1.1, -max_dimension * 2.3, size.z * 0.08))
    look_at(camera, center)
    scene.camera = camera

    lights = (
        ("DG_KEY", 1700, (-1.1, -1.6, 1.4), 0.82),
        ("DG_RIM", 1250, (1.4, 0.8, 1.2), 0.66),
        ("DG_FILL", 720, (1.3, -1.0, 0.35), 0.9),
    )
    for name, energy, direction, scale in lights:
        light_data = bpy.data.lights.new(name, "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = max_dimension * scale
        light = bpy.data.objects.new(name, light_data)
        light.location = center + Vector(tuple(max_dimension * value for value in direction))
        scene.collection.objects.link(light)
        look_at(light, center)

    ensure_directory(preview_dir)
    return center, size


def render_material_previews(scene, semantic_objects, surface_materials, preview_dir):
    for surface, material in surface_materials.items():
        for obj in semantic_objects["seat"] + semantic_objects["backrest"] + semantic_objects["pillow"]:
            assign_material(obj, material)
        scene.render.filepath = os.path.join(preview_dir, f"vortex-x7-{surface}.png")
        bpy.ops.render.render(write_still=True)


arguments = args_after_separator()
if len(arguments) != 5:
    raise SystemExit(
        "Usage: blender --background --python prepare_vortex.py -- input.glb output.glb texture_dir preview_dir source.blend"
    )

input_path, output_glb, texture_dir, preview_dir, blend_path = map(os.path.abspath, arguments)
ensure_directory(os.path.dirname(output_glb))
ensure_directory(texture_dir)
ensure_directory(preview_dir)
ensure_directory(os.path.dirname(blend_path))

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=input_path, merge_vertices=False)
meshes = sorted((obj for obj in bpy.context.scene.objects if obj.type == "MESH"), key=lambda obj: obj.name)

images = generate_surface_textures(texture_dir)
surface_materials = {surface: create_surface_material(surface, images) for surface in images}
accent_material = create_simple_material("DG_ACCENT", (0.04, 0.82, 0.42), roughness=0.38)
fixed_plastic = create_simple_material("DG_FIXED_PLASTIC", (0.025, 0.032, 0.03), roughness=0.42)
fixed_metal = create_simple_material("DG_FIXED_BLACK_METAL", (0.006, 0.008, 0.008), roughness=0.28, metallic=0.55)
semantic_objects = configure_semantic_meshes(
    meshes,
    surface_materials["textile"],
    accent_material,
    fixed_plastic,
    fixed_metal,
)

manifest = {
    group: [obj.name for obj in objects]
    for group, objects in semantic_objects.items()
}
with open(os.path.join(os.path.dirname(output_glb), "vortex-x7-manifest.json"), "w", encoding="utf-8") as handle:
    json.dump(manifest, handle, indent=2)

# Export a clean GLB with the textile preset as its neutral default.
bpy.ops.export_scene.gltf(
    filepath=output_glb,
    export_format="GLB",
    export_apply=True,
    export_yup=True,
    export_attributes=True,
)

configure_studio(bpy.context.scene, meshes, preview_dir)
render_material_previews(bpy.context.scene, semantic_objects, surface_materials, preview_dir)

# Leave the editable source in the same default state as the exported GLB.
for obj in semantic_objects["seat"] + semantic_objects["backrest"] + semantic_objects["pillow"]:
    assign_material(obj, surface_materials["textile"])
bpy.ops.wm.save_as_mainfile(filepath=blend_path)

print(
    json.dumps(
        {
            "output_glb": output_glb,
            "texture_dir": texture_dir,
            "preview_dir": preview_dir,
            "blend_path": blend_path,
            "manifest": manifest,
        }
    )
)

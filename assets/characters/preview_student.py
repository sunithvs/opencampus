"""Render poses from the actual exported GLB to verify round-trip rigging."""
import bpy
import json
from mathutils import Vector
from pathlib import Path

out=Path('/Users/sunithvs/Documents/Codex/2026-09-09/plugin-creator-users-sunithvs-codex-skills/outputs')
scene=bpy.context.scene
# Import into the studio after removing the authoring mesh and rig from this scene.
for name in ['CampusStudent_Mesh','FaceImage','CampusStudent']:
    scene.collection.objects.unlink(bpy.data.objects[name])
bpy.ops.import_scene.gltf(filepath='/Users/sunithvs/PycharmProjects/clg campus/public/models/campus-student.glb')
rig=next(o for o in scene.objects if o.type=='ARMATURE')
meshes=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers)]
actions={}
for track in rig.animation_data.nla_tracks:
    for strip in track.strips:
        actions[track.name]=(strip.action,strip.action_slot)
    track.mute=True
print('ROUNDTRIP_ACTIONS',list(actions))
assert len(actions)==5
report=[]
for index,(name,frame) in enumerate([('Idle',0),('Walk',8),('Run',6),('Wave',38),('Sit',0)]):
    key=next(k for k in actions if name in k)
    rig.animation_data.action,rig.animation_data.action_slot=actions[key]
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    depsgraph=bpy.context.evaluated_depsgraph_get()
    points=[]
    for source in meshes:
        evaluated=source.evaluated_get(depsgraph)
        mesh=bpy.data.meshes.new_from_object(evaluated,depsgraph=depsgraph)
        obj=bpy.data.objects.new(name+' preview',mesh)
        scene.collection.objects.link(obj)
        obj.matrix_world=source.matrix_world.copy()
        points += [obj.matrix_world @ v.co for v in mesh.vertices]
        obj.location.x+=(index-2)*1.10
    report.append({'clip':name,'min_z':min(p.z for p in points),'max_z':max(p.z for p in points)})
    font=bpy.data.curves.new(name,'FONT');font.body=name.upper();font.size=.105;font.align_x='CENTER'
    label=bpy.data.objects.new(name+' label',font);scene.collection.objects.link(label)
    label.location=((index-2)*1.10,-.36,-.008);label.rotation_euler=(0,0,0)
for m in meshes:m.hide_render=True
scene.camera.location=(2,-9,5.0)
scene.camera.rotation_euler=(Vector((0,0,.78))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
scene.camera.data.ortho_scale=6.25
scene.render.resolution_x=1800;scene.render.resolution_y=850
scene.render.filepath=str(out/'campus-student-animations.png')
scene.cycles.samples=24
bpy.ops.render.render(write_still=True)
print('ROUNDTRIP_VALIDATION '+json.dumps(report))

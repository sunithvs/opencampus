"""Rebuild the Campus Student asset in Blender 5.2. No external assets required."""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

PROJECT = Path('/Users/sunithvs/PycharmProjects/clg campus')
OUTPUT = Path('/Users/sunithvs/Documents/Codex/2026-09-09/plugin-creator-users-sunithvs-codex-skills/outputs')
scene = bpy.data.scenes.new('Campus Student • Asset Studio')
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.render.fps = 30
parts = []

def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = .82
    return m

skin = material('Skin • warm brown', (.48, .255, .13))
shirt = material('Shirt • oat cotton', (.74, .69, .53))
trim = material('Shirt • collar and hems', (.53, .50, .36))
pants = material('Trousers • charcoal', (.065, .10, .09))
bag = material('Backpack • forest', (.055, .20, .135))
bagdark = material('Backpack • webbing', (.025, .075, .052))
sole = material('Sneakers • warm ivory', (.86, .85, .75))
shoe = material('Sneakers • sage canvas', (.26, .35, .27))
accent = material('Details • brass', (.67, .40, .12))

def finish(obj, name, mat, bone):
    obj.name = name
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bone:
        obj.vertex_groups.new(name=bone).add(list(range(len(obj.data.vertices))), 1, 'REPLACE')
        parts.append(obj)
    return obj

def ellipsoid(name, pos, scale, mat, bone, seg=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat, bone)

def box(name, pos, scale, mat, bone, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Soft tailored edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, bone)

def tapered(name, ring_data, mat, bone, segments=12):
    verts, faces = [], []
    for x, y, z, rx, ry in ring_data:
        verts += [(x+rx*math.cos(i*math.tau/segments), y+ry*math.sin(i*math.tau/segments), z) for i in range(segments)]
    faces.append(tuple(reversed(range(segments))))
    for r in range(len(ring_data)-1):
        for i in range(segments):
            a = r*segments+i
            b = r*segments+(i+1)%segments
            faces.append((a,b,b+segments,a+segments))
    faces.append(tuple(range((len(ring_data)-1)*segments,len(verts))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name,mesh)
    scene.collection.objects.link(obj)
    return finish(obj,name,mat,bone)

# Neutral avatar: relaxed straight clothing, no gender-specific facial or hair styling.
# Metres, Z up, facing -Y; sole lies on Z=0.
tapered('Relaxed shirt',[(0,0,.93,.220,.14),(0,0,1.03,.225,.145),(0,0,1.29,.235,.15),(0,0,1.40,.235,.14),(0,0,1.465,.135,.105)],shirt,'chest')
tapered('Shirt hem',[(0,0,.935,.222,.142),(0,0,.965,.224,.144)],trim,'chest')
ellipsoid('Pelvis',(0,0,.91),(.210,.135,.145),pants,'hips')
ellipsoid('Neck',(0,0,1.485),(.075,.070,.115),skin,'chest')
tapered('Collar',[(0,0,1.445,.103,.087),(0,0,1.472,.083,.074)],trim,'chest')
box('Neutral rounded head',(0,0,1.685),(.33,.27,.33),skin,'head',.024)

# Independent square image plane: four corners, full-image UVs, no facial geometry.
# 1 mm forward offset prevents z-fighting against the head's flat front.
face_size=.272
z=1.685
h=face_size/2
mesh=bpy.data.meshes.new('FaceImage_Plane')
mesh.from_pydata([(-h,-.136,z-h),(h,-.136,z-h),(h,-.136,z+h),(-h,-.136,z+h)],[],[(0,1,2,3)])
mesh.update()
uv=mesh.uv_layers.new(name='UVMap')
for i,co in enumerate([(0,0),(1,0),(1,1),(0,1)]):uv.data[i].uv=co
face=bpy.data.objects.new('FaceImage',mesh)
scene.collection.objects.link(face)
face_mat=material('FaceImage',(.48,.255,.13))
placeholder=bpy.data.images.new('face-placeholder.png',width=512,height=512,alpha=False)
placeholder.generated_color=(.48,.255,.13,1)
placeholder.filepath_raw=str(PROJECT/'assets/characters/face-placeholder.png')
placeholder.file_format='PNG'
placeholder.save()
placeholder.pack()
tex=face_mat.node_tree.nodes.new('ShaderNodeTexImage')
tex.name='Face Image — replace with your square image'
tex.image=placeholder
shader=next(n for n in face_mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
face_mat.node_tree.links.new(tex.outputs['Color'],shader.inputs['Base Color'])
face.data.materials.append(face_mat)
face.vertex_groups.new(name='head').add([0,1,2,3],1,'REPLACE')
face['image_aspect_ratio']='1:1'
face['image_replacement']='Replace FaceImage material base-color texture; UVs cover the full square.'

bones=[('root',(0,0,0),(0,0,.2),None),('hips',(0,0,.91),(0,0,1.04),'root'),('chest',(0,0,1.04),(0,0,1.46),'hips'),('head',(0,0,1.46),(0,0,1.82),'chest')]
for side,suffix in [(-1,'L'),(1,'R')]:
    shoulder=(side*.235,0,1.405);elbow=(side*.307,0,1.145);wrist=(side*.333,-.018,.913)
    hip=(side*.108,0,.91);knee=(side*.112,0,.505);ankle=(side*.115,0,.12)
    bones += [(f'upper_arm.{suffix}',shoulder,elbow,'chest'),(f'forearm.{suffix}',elbow,wrist,f'upper_arm.{suffix}'),(f'hand.{suffix}',wrist,(side*.335,-.018,.81),f'forearm.{suffix}'),(f'thigh.{suffix}',hip,knee,'hips'),(f'shin.{suffix}',knee,ankle,f'thigh.{suffix}'),(f'foot.{suffix}',ankle,(side*.115,-.19,.075),f'shin.{suffix}')]
    arm=f'upper_arm.{suffix}'; fore=f'forearm.{suffix}'; hand=f'hand.{suffix}'
    ellipsoid('Shoulder',shoulder,(.084,.097,.078),shirt,arm)
    tapered('Short sleeve',[(side*.285,0,1.23,.088,.092),(side*.250,0,1.40,.103,.105)],shirt,arm)
    tapered('Sleeve cuff',[(side*.285,0,1.224,.089,.093),(side*.281,0,1.25,.092,.096)],trim,arm)
    tapered('Upper arm',[(side*.307,0,1.138,.062,.062),(side*.279,0,1.265,.073,.071)],skin,arm)
    ellipsoid('Elbow',elbow,(.063,.062,.060),skin,fore)
    tapered('Forearm',[(side*.333,-.018,.911,.042,.045),(side*.324,-.012,1.00,.055,.055),(side*.307,0,1.16,.061,.061)],skin,fore)
    ellipsoid('Palm',(side*.335,-.018,.866),(.049,.040,.078),skin,hand)
    ellipsoid('Thumb',(side*.296,-.041,.884),(.023,.026,.043),skin,hand)
    thigh=f'thigh.{suffix}';shin=f'shin.{suffix}';foot=f'foot.{suffix}'
    tapered('Trouser thigh',[(side*.112,0,.487,.080,.090),(side*.108,0,.74,.099,.112),(side*.108,0,.96,.105,.118)],pants,thigh)
    ellipsoid('Trouser knee',knee,(.081,.087,.082),pants,shin)
    tapered('Trouser shin',[(side*.115,0,.145,.067,.073),(side*.114,0,.34,.076,.086),(side*.112,0,.52,.080,.088)],pants,shin)
    tapered('Rolled trouser cuff',[(side*.115,0,.142,.070,.077),(side*.115,0,.180,.071,.077)],pants,shin)
    box('Sneaker sole',(side*.115,-.059,.030),(.164,.292,.060),sole,foot,.023)
    box('Canvas sneaker',(side*.115,-.052,.083),(.153,.267,.105),shoe,foot,.039)
    box('Rubber toe',(side*.115,-.160,.062),(.146,.067,.055),sole,foot,.019)
    for y in [-.095,-.068,-.041]:
        box('Shoelace',(side*.115,y,.137),(.083,.010,.007),sole,foot,.003)
    # Shoulder straps sit against the shirt and continue over the shoulders.
    strap=box('Front backpack strap',(side*.168,-.139,1.285),(.045,.026,.316),bagdark,'chest',.012)
    strap.rotation_euler.y=side*.06
    ellipsoid('Over shoulder webbing',(side*.17,.002,1.443),(.025,.16,.031),bagdark,'chest')
    box('Strap adjuster',(side*.167,-.159,1.20),(.048,.015,.027),accent,'chest',.004)

box('Backpack body',(0,.197,1.231),(.365,.198,.424),bag,'chest',.061)
box('Backpack front pocket',(0,.309,1.132),(.272,.060,.163),bagdark,'chest',.027)
box('Pocket zipper',(0,.344,1.186),(.232,.010,.009),accent,'chest',.003)
box('Backpack patch',(0,.307,1.317),(.073,.013,.049),sole,'chest',.009)
box('Patch stripe',(0,.316,1.317),(.036,.009,.010),bag,'chest',.002)
box('Shirt pocket',(-.112,-.153,1.306),(.073,.012,.079),trim,'chest',.008)
box('Pocket face',(-.112,-.161,1.310),(.063,.007,.061),shirt,'chest',.006)

# A single skinned mesh keeps runtime object and draw-call counts predictable.
bpy.ops.object.select_all(action='DESELECT')
for p in parts:p.select_set(True)
bpy.context.view_layer.objects.active=parts[0]
bpy.ops.object.join()
body=bpy.context.object;body.name='CampusStudent_Mesh'
scene.cursor.location=(0,0,0)
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
arm_data=bpy.data.armatures.new('CampusStudent_Skeleton')
rig=bpy.data.objects.new('CampusStudent',arm_data);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;body.select_set(False);rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,head,tail,parent in bones:
    b=arm_data.edit_bones.new(name);b.head=head;b.tail=tail
    if parent:b.parent=arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode='OBJECT')
for skinned in [body,face]:
    skinned.parent=rig
    mod=skinned.modifiers.new('Student skeleton','ARMATURE');mod.object=rig
rig['height_m']=1.85
rig['forward_axis']='-Y in Blender; +Z after glTF export'
rig['usage']='In-place animation. Move the actor root in your game.'
for b in rig.pose.bones:b.rotation_mode='XYZ'

clips=[]
def make_clip(name, frames, fn, loop=True):
    rig.animation_data_create();rig.animation_data.action=None
    action=bpy.data.actions.new(name);action.use_fake_user=True
    rig.animation_data.action=action
    for f in range(frames+1):
        t=f/frames
        for b in rig.pose.bones:
            b.rotation_euler=(0,0,0);b.location=(0,0,0)
        fn(t)
        if name in ('Walk', 'Run'):
            bpy.context.view_layer.update()
            foot_z=[]
            for suffix in ['L','R']:
                pb=rig.pose.bones['foot.'+suffix]
                transform=pb.matrix @ pb.bone.matrix_local.inverted()
                group=body.vertex_groups['foot.'+suffix].index
                foot_z += [(transform @ v.co).z for v in body.data.vertices if any(g.group==group for g in v.groups)]
            flight=.035*(1-math.cos(t*math.tau*2)) if name=='Run' else 0
            rig.pose.bones['hips'].location.y+=flight-min(foot_z)
        for b in rig.pose.bones:
            b.keyframe_insert('rotation_euler',frame=f)
            b.keyframe_insert('location',frame=f)
    clips.append({'name':name,'frames':[0,frames],'seconds':frames/30,'loop':loop})
    return action

def rot(name,x=0,y=0,z=0):rig.pose.bones[name].rotation_euler=(x,y,z)
def idle(t):
    a=math.sin(t*math.tau)
    rig.pose.bones['hips'].location.y=.004*a
    rot('chest',.012*a,0,.012*a)
    rot('head',0,.024*a,0)
    for s in ['L','R']:rot('forearm.'+s,-.06-.015*a)
def gait(t,running=False):
    a=t*math.tau
    rig.pose.bones['hips'].location.y=(.045 if running else .018)*(1-math.cos(2*a))
    rot('chest',.10 if running else .035,0,.028*math.sin(a))
    for i,s in enumerate(['L','R']):
        c=math.sin(a+i*math.pi)
        rot('thigh.'+s,-(.85 if running else .49)*c)
        rot('shin.'+s,max(0,c)*(.95 if running else .65)+.055)
        rot('foot.'+s,.12*c)
        rot('upper_arm.'+s,(.65 if running else .35)*c)
        rot('forearm.'+s,-.85 if running else -.12)
def wave(t):
    idle(t)
    envelope=min(1,t*6,(1-t)*6)
    rot('upper_arm.R',0,0,-2.35*envelope)
    rot('forearm.R',0,.1*envelope,(.20+.24*math.sin(t*math.tau*3))*envelope)
    rot('hand.R',.15*math.sin(t*math.tau*3)*envelope)
def sit(t):
    rig.pose.bones['hips'].location.y=-.40
    rot('chest',.055)
    for s in ['L','R']:
        rot('thigh.'+s,-math.pi/2);rot('shin.'+s,math.pi/2)
        rot('upper_arm.'+s,-.35);rot('forearm.'+s,-.80)
    rot('head',.015*math.sin(t*math.tau))

idle_action=make_clip('Idle',90,idle)
make_clip('Walk',30,gait)
make_clip('Run',22,lambda t:gait(t,True))
make_clip('Wave',75,wave,False)
make_clip('Sit',90,sit)
rig.animation_data.action=idle_action
scene.frame_start=0;scene.frame_end=90;scene.frame_set(0)

OUTPUT.mkdir(parents=True,exist_ok=True)
export_path=PROJECT/'public/models/campus-student.glb'
export_path.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);body.select_set(True);face.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath=str(export_path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_cameras=False,export_lights=False)
(OUTPUT/'campus-student.glb').write_bytes(export_path.read_bytes())
body.data.calc_loop_triangles()
metadata={'asset':'Campus Student','height_m':1.85,'triangles':len(body.data.loop_triangles)+2,'bones':len(bones),'materials':len(body.data.materials)+1,'meshes':2,'face':{'mesh':'FaceImage','material':'FaceImage','size_m':face_size,'uv':'Full 0–1 square, upright, no mirroring','texture':'face-placeholder.png'},'animations':clips,'forward':'Blender -Y, glTF +Z','license':'Original generated geometry; no third-party assets','export':str(export_path)}
(PROJECT/'assets/characters/campus-student.json').write_text(json.dumps(metadata,indent=2))

# Studio is excluded from GLB; keep it in the blend for useful previews.
floor=material('Studio • pale sage',(.31,.40,.35))
box('Studio floor',(0,0,-.045),(200,200,.08),floor,None,0)
def aim(obj,point):obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
for name,pos,power,size in [('Key',(-3,-4,6),450,4),('Fill',(4,-1,3),250,3),('Rim',(1,3,5),600,3)]:
    data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;data.energy=power;data.shape='DISK';data.size=size;aim(obj,(0,0,1))
camera_data=bpy.data.cameras.new('Portrait camera');camera=bpy.data.objects.new('Portrait camera',camera_data);scene.collection.objects.link(camera)
camera.location=(3,-5,2.65);aim(camera,(0,0,.96));camera_data.type='ORTHO';camera_data.ortho_scale=2.42;scene.camera=camera
scene.world=bpy.data.worlds.new('Studio world');scene.world.use_nodes=True
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.45,.50,.46,1)
next(n for n in scene.world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.4
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=32
scene.render.resolution_x=900;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(OUTPUT/'campus-student-preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':
        area.spaces.active.region_3d.view_perspective='CAMERA'
        area.spaces.active.shading.type='MATERIAL'
        area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'campus-student.blend'))
print('CAMPUS_STUDENT_COMPLETE '+json.dumps(metadata))

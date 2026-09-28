"""Original campus trees, Blender 5.2. Run in background with --factory-startup."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector
PROJECT=Path('/Users/sunithvs/PycharmProjects/clg campus')
OUTPUT=Path('/Users/sunithvs/Documents/Codex/2026-09-09/plugin-creator-users-sunithvs-codex-skills/outputs')
rng=random.Random(216)
scene=bpy.data.scenes.new('Campus Trees • Asset Studio');bpy.context.window.scene=scene
scene.unit_settings.system='METRIC'

class Geometry:
    def __init__(self):self.v=[];self.f=[];self.colors=[]
    def face(self,points,color):
        k=len(self.v);self.v.extend(points);self.f.append(tuple(range(k,k+len(points))));self.colors.extend([(*color,1)]*len(points))
    def tube(self,points,radii,color,sides=8):
        for j in range(len(points)-1):
            a,b=Vector(points[j]),Vector(points[j+1]);direction=(b-a).normalized()
            u=direction.cross(Vector((0,1,0))).normalized();w=direction.cross(u).normalized()
            for i in range(sides):
                t=i*math.tau/sides;t2=(i+1)*math.tau/sides
                c=tuple(v*(.85+.18*(i%3)/2) for v in color)
                self.face([a+(u*math.cos(t)+w*math.sin(t))*radii[j],a+(u*math.cos(t2)+w*math.sin(t2))*radii[j],b+(u*math.cos(t2)+w*math.sin(t2))*radii[j+1],b+(u*math.cos(t)+w*math.sin(t))*radii[j+1]],c)
    def leaf(self,a,b,width,color,fold=.07):
        a,b=Vector(a),Vector(b);d=b-a
        side=d.cross(Vector((0,0,1))).normalized()*width
        mid=a+d*.45;ridge=mid+Vector((0,0,fold))
        for pts in [[a,mid+side,ridge],[mid+side,b,ridge],[b,mid-side,ridge],[mid-side,a,ridge]]:self.face(pts,color)
    def object(self,name,material):
        mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update()
        color=mesh.color_attributes.new(name='TreeColor',type='FLOAT_COLOR',domain='POINT')
        for v,c in zip(color.data,self.colors):v.color=c
        obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj);mesh.materials.append(material)
        return obj

def mat(name,two_sided=False):
    m=bpy.data.materials.new(name);m.use_nodes=True
    p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Roughness'].default_value=.95
    v=m.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='TreeColor';m.node_tree.links.new(v.outputs['Color'],p.inputs['Base Color'])
    m.use_backface_culling=not two_sided
    return m
barkmat=mat('Bark • vertex colors');leafmat=mat('Foliage • vertex colors',True)

def export(objects,filename):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:o.select_set(True)
    bpy.context.view_layer.objects.active=objects[0]
    path=PROJECT/'public/models'/filename
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_animations=False,export_cameras=False,export_lights=False)
    (OUTPUT/filename).write_bytes(path.read_bytes())
    report={'file':filename,'bytes':path.stat().st_size,'parts':[]}
    for o in objects:
        o.data.calc_loop_triangles();report['parts'].append({'name':o.name,'triangles':len(o.data.loop_triangles)})
    report['triangles']=sum(p['triangles'] for p in report['parts'])
    return report

# Curved palm stem with alternating growth rings, flared base, and dense feather fronds.
bark=Geometry();leaves=Geometry()
def stem(t):return Vector((.20*math.sin(t*1.8),.09*math.sin(t*2.7),8*t))
for j in range(52):
    t=j/52;t2=(j+1)/52;r=.19+.065*(1-t)+.075*math.exp(-t*30)
    bark.tube([stem(t),stem(t+.010),stem(t2)],[r+.012,r,r-.002],(.27+.06*(j%2),.22+.04*(j%2),.15+.03*(j%2)),10)
for i in range(7):
    a=i*math.tau/7
    bark.tube([(math.cos(a)*.50,math.sin(a)*.50,.02),(math.cos(a)*.21,math.sin(a)*.21,.26),(0,0,.62)],[.045,.08,.12],(.28,.23,.16),6)
crown=stem(1)
bark.tube([stem(.95),crown,crown+Vector((0,0,.40))],[.26,.29,.09],(.23,.29,.09),10)
for i in range(18):
    a=i*2.399963;direction=Vector((math.cos(a),math.sin(a),0));side=Vector((-math.sin(a),math.cos(a),0))
    length=rng.uniform(3.0,4.1);rise=.85 if i<12 else 1.65;droop=1.45 if i<12 else .25
    def p(t):return crown+direction*length*t+Vector((0,0,.15+rise*math.sin(t*math.pi*.85)-droop*t*t))
    pts=[p(j/12) for j in range(13)]
    bark.tube(pts,[.034*(1-j/13)+.006 for j in range(13)],(.24,.32,.07),5)
    for j in range(1,23):
        t=j/24;length_leaf=.92*(math.sin(t*math.pi)**.65)+.09
        for sign in [-1,1]:
            start=p(t);end=start+side*(sign*length_leaf)+direction*(.20+.42*t)+Vector((0,0,-.18-.24*t))
            shade=rng.uniform(.83,1.2);base=(.105,.265,.048) if i%3 else (.18,.34,.065)
            leaves.leaf(start,end,.065+.045*math.sin(t*math.pi),tuple(v*shade for v in base),.035)
    leaves.leaf(p(.90),p(1.08),.08,(.16,.30,.045),.025)
palm=[bark.object('Palm_Bark',barkmat),leaves.object('Palm_Foliage',leafmat)]
palm_report=export(palm,'campus-palm.glb')

# Shade tree with buttress roots, exposed forked branches, and overlapping leaf sprays.
bark=Geometry();leaves=Geometry()
trunk=[(0,0,0),(.02,.02,.35),(-.07,.03,1.5),(.02,-.03,2.8),(.12,0,3.8),(.20,.05,4.8)]
bark.tube(trunk,[.36,.27,.215,.19,.14,.05],(.20,.12,.065),12)
for i in range(9):
    a=i*math.tau/9
    bark.tube([(math.cos(a)*.70,math.sin(a)*.70,.012),(math.cos(a)*.34,math.sin(a)*.34,.22),(0,0,.85)],[.025,.12,.18],(.22,.14,.075),7)
clusters=[]
for i in range(11):
    a=i*2.399963
    start=Vector((0,0,2.55+(i%4)*.38))
    reach=1.65 if i<7 else 1.0
    end=Vector((math.cos(a)*reach,math.sin(a)*reach,4.45+(i%4)*.48))
    middle=start.lerp(end,.55)+Vector((0,0,.30))
    bark.tube([start,middle,end],[.12,.077,.027],(.25,.155,.08),8)
    for j in range(4):
        angle=a+(j-1.5)*.58
        tip=end+Vector((math.cos(angle)*rng.uniform(.50,1.1),math.sin(angle)*rng.uniform(.50,1.1),rng.uniform(.22,.9)))
        bark.tube([middle.lerp(end,.80),end,tip],[.043,.027,.006],(.24,.15,.075),6)
        clusters.append(tip)
        for k in range(34):
            theta=rng.uniform(0,math.tau);u=rng.uniform(-1,1);r=rng.random()**(1/3)
            pos=tip+Vector((math.cos(theta)*math.sqrt(1-u*u)*r*.83,math.sin(theta)*math.sqrt(1-u*u)*r*.83,u*r*.52))
            angle=theta+rng.uniform(-.6,.6)
            length=rng.uniform(.38,.69)
            endleaf=pos+Vector((math.cos(angle)*length,math.sin(angle)*length,rng.uniform(-.22,.20)))
            shade=rng.uniform(.75,1.25);base=(.10,.24,.055) if k%4 else (.19,.32,.07)
            leaves.leaf(pos,endleaf,rng.uniform(.12,.20),tuple(v*shade for v in base),.055)
shade=[bark.object('ShadeTree_Bark',barkmat),leaves.object('ShadeTree_Foliage',leafmat)]
shade_report=export(shade,'campus-shade-tree.glb')
reports=[palm_report,shade_report]
(PROJECT/'assets/trees/tree-assets.json').write_text(json.dumps(reports,indent=2))

# Editorial studio view of both models. Excluded from the exported files.
for obj in palm:obj.location.x=-4.1
for obj in shade:obj.location.x=4.0
m=bpy.data.materials.new('Studio • warm stone');m.diffuse_color=(.43,.47,.39,1);m.use_nodes=True
next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED').inputs['Base Color'].default_value=(.43,.47,.39,1)
bpy.ops.mesh.primitive_plane_add(size=200);bpy.context.object.name='Studio ground';bpy.context.object.data.materials.append(m);bpy.context.object.location.z=-.015
world=bpy.data.worlds.new('Tree studio');world.use_nodes=True;scene.world=world
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[0].default_value=(.65,.72,.64,1)
next(n for n in world.node_tree.nodes if n.type=='BACKGROUND').inputs[1].default_value=.45
for name,pos,energy,size in [('Key',(-7,-8,15),2300,8),('Fill',(8,-2,11),1600,7),('Rim',(0,9,14),2600,6)]:
    d=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=pos;d.energy=energy;d.shape='DISK';d.size=size;o.rotation_euler=(Vector((0,0,4))-o.location).to_track_quat('-Z','Y').to_euler()
d=bpy.data.cameras.new('Tree showcase');o=bpy.data.objects.new('Tree showcase',d);scene.collection.objects.link(o);o.location=(16,-28,16);o.rotation_euler=(Vector((0,0,4.3))-o.location).to_track_quat('-Z','Y').to_euler();d.type='ORTHO';d.ortho_scale=21;scene.camera=o
try:scene.render.engine='CYCLES'
except TypeError:pass
scene.cycles.samples=24;scene.cycles.use_denoising=True
scene.render.resolution_x=1500;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUTPUT/'campus-trees-preview.png')
for area in bpy.context.screen.areas:
    if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA';area.spaces.active.shading.type='MATERIAL';area.spaces.active.overlay.show_overlays=False
bpy.ops.wm.save_as_mainfile(filepath=str(OUTPUT/'campus-trees.blend'))
print('TREE_ASSETS '+json.dumps(reports))
bpy.ops.render.render(write_still=True)

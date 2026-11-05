"""Screenshot-led, editable PowerPoint redesign; preserve the previous output."""
from pathlib import Path
import struct
import json
import html

ROOT = Path(__file__).resolve().parents[1]
BUILD = ROOT / 'tmp' / 'visual-deck'
BUILD.mkdir(parents=True, exist_ok=True)
ASSETS = ROOT / 'docs' / 'assets' / 'phase2-visual'
slides = []
PURPLE = '49176D'
GOLD = 'F2B700'

def slide(title, note, bg='FFFFFF'):
    s = {'title': title, 'notes': note, 'background': bg, 'items': []}
    slides.append(s)
    return s

def text(s, value, x, y, w, h, size=24, color='222222', bold=False, space=1100, font='Arial'):
    s['items'].append(dict(kind='text', text=value, x=x, y=y, w=w, h=h, size=size, color=color, bold=bold, space=space, font=font))

def image(s, name, x, y, w, h, crop=(0,0)):
    iw, ih = struct.unpack('>II', (ASSETS / (name+'.png')).read_bytes()[16:24])
    ih *= 1-(crop[0]+crop[1])/100000
    scale = min(w/iw, h/ih)
    w2,h2=iw*scale,ih*scale
    s['items'].append(dict(kind='image', file=name+'.png', x=x+(w-w2)/2, y=y+(h-h2)/2, w=w2, h=h2, crop=crop))

def heading(s, title, label=None):
    if label: text(s,label,.65,.35,12,.3,13,PURPLE,True,0)
    text(s,title,.65,.88 if label else .6,12,1.05,32,PURPLE,True,0)

s=slide('Follow one package', 'Introduce CampusEco: one perimeter hub, electric-cart crews, and campus recipients. Phase 2 connects the static Phase 1 screens. Group members listed on slide. Screenshot: actual local application home page.', PURPLE)
text(s,'MNSU-CampusEco',.65,.7,11,.5,21,'FFFFFF',True,0)
text(s,'Follow one\npackage.',.65,2.0,4.5,2.15,43,'FFFFFF',True,400)
text(s,'From the hub\nto the recipient.',.68,4.48,4.4,1.15,23,'FFFFFF',False,300)
text(s,'Technical Presentation 1 · Phase 2',.68,6.15,6,.45,17,'FFFFFF',False,0)
image(s,'home',5.4,1.65,7.25,5.04)
text(s,'Misgana Kebede · Clement Mbuyi · Yonatan Alemayehu · Emran Abatemam',.68,7.02,12,.25,11,'FFFFFF',False,0)

s=slide('Phase 1 vs Phase 2','Explain the difference in plain language: Phase 1 supplied the static structure; Phase 2 handles events, renders current data, and remembers local changes. Sources: README.md, pages/, js/app.js. Do not imply a production backend exists.')
heading(s,'The screens are now connected')
text(s,'PHASE 1',.8,2.03,5,.4,18,'666666',True,0)
text(s,'Build the screens',.8,2.65,5.3,.75,30,PURPLE,True,0)
text(s,'Forms and navigation\nCampus styling\nSample delivery records',.8,3.65,5.2,2.4,25,space=1800)
text(s,'PHASE 2',7.05,2.03,5,.4,18,PURPLE,True,0)
text(s,'Make them respond',7.05,2.65,5.6,.75,30,PURPLE,True,0)
text(s,'Submit and update\nShare data across portals\nRemember after refresh',7.05,3.65,5.5,2.4,25,space=1800)
text(s,'HTML + CSS',.8,6.55,5,.4,17,'666666',False,0)
text(s,'JavaScript + jQuery + browser storage',7.05,6.55,5.6,.4,17,'666666',False,0)

s=slide('Receive at the hub','Live demo step 1: enter CE-20261004; weight 3.2 lb; dimensions 12 × 8 × 6 in; choose Julia Sears Hall and urgent priority. Click Check in. Native constraints still reject missing or invalid values. Screenshot shows the real filled form before submission. Source: pages/operator.html, js/app.js checkin handler.')
heading(s,'1. Receive it at the hub','HUB OPERATOR')
image(s,'checkin',.65,1.95,6.5,4.9)
text(s,'Enter the details.\nChoose a building.\nClick Check in.',7.7,2.55,4.8,2.7,29,PURPLE,True,2200)
text(s,'The form checks the input\nbefore adding the package.',7.7,5.65,4.8,1.0,21,space=300)

s=slide('Tracking row appears','The form handler prevents the default navigation. It constructs a Package, rejects duplicates, saves it, and renders the new row. The screenshot is filtered to CE-20261004 so the audience can see the new record. Sources: js/app.js form(), change(), renderOperator(); js/models.js Package.')
heading(s,'The new row appears immediately','JAVASCRIPT + jQUERY')
text(s,'No page reload. The package is ready for the crew.',.75,1.8,11.8,.65,25)
image(s,'new-row',.75,2.8,11.8,3.14)
text(s,'CE-20261004 is now part of the shared browser data.',.75,6.4,11.8,.5,23,PURPLE,True,0)

s=slide('Claim and deliver','Start ECO-1234 with cart-01. Its battery is filled automatically. Show the Claim button for CE-20261004; claim it, then advance Loaded → En Route → Delivered. The driver owns the delivery and cannot skip stages. The screenshot shows the real queue before claiming. Sources: Package.claim, Package.advance, renderCrew and delegated claim handler.')
heading(s,'2. Claim it and move it','ECO-TRANSIT CREW')
image(s,'claim-queue',.75,1.9,11.8,4.22)
text(s,'Loaded   →   En Route   →   Delivered',1.15,6.45,11.2,.6,28,PURPLE,True,0)

s=slide('Track and sign','In Campus End-User, enter CE-20261004. It now shows Delivered and the full history. Select the delivered package, type Demo Recipient, check consent, and confirm receipt. Sign-off is allowed only once after delivery. Both screenshots are from the completed real demo sequence. Sources: renderTracking(), signoff handler, Package.sign().')
heading(s,'3. Track it. Confirm receipt.','CAMPUS END-USER')
text(s,'Same tracking number. Now marked Delivered.',.75,1.85,11.8,.45,23)
image(s,'tracking',.75,2.65,6.1,4.12,crop=(0,44000))
image(s,'receipt',7.45,2.65,5.1,4.12)

s=slide('jQuery interactions','Click Edit preferences to reveal the options. Show slideDown and slideUp in the toggle function, then the .animate call for the cart marker. The marker shows a schematic transit stage, not GPS. These are actual screenshots from collapsed/expanded states and the En Route stage. Sources: js/app.js toggle(), updateMilestone(); jQuery official docs https://api.jquery.com/on/ and https://api.jquery.com/animate/ .')
heading(s,'Small clicks. Visible changes.','jQUERY')
text(s,'Click Edit preferences',.75,1.85,5.8,.45,23,PURPLE,True,0)
image(s,'preferences-closed',.75,2.55,5.75,1.34)
text(s,'The panel slides open →',.75,4.1,5.8,.55,23,PURPLE,True,0)
image(s,'route-marker',.75,5.05,5.75,1.42)
text(s,'The cart moves when its status changes.',.75,6.65,6.0,.4,16,'666666',False,0)
image(s,'preferences-open',7.15,1.85,5.45,4.7,crop=(0,46000))
text(s,'More options, when you need them.',7.15,6.65,5.45,.4,16,'666666',False,0)

s=slide('Responsive layout','Resize the browser. Show desktop workspace columns and the same CE-20261004 delivery card at 390 pixels. The phone image is a crop of the actual mobile route queue, not a mockup. Explain that the queue becomes labeled cards, navigation wraps, and hub tables scroll inside their regions. Sources: css/phase2.css, css/courier.css, viewport tests.')
heading(s,'Same delivery. Smaller screen.','RESPONSIVE DESIGN')
text(s,'Desktop: two dashboard columns',.75,1.85,8.2,.4,22,PURPLE,True,0)
image(s,'desktop-workspace',.75,2.55,8.15,3.65)
text(s,'Phone: a readable card',9.35,1.85,3.25,.7,21,PURPLE,True,0)
image(s,'mobile-queue',9.4,2.8,3.1,3.35,crop=(46600,27000))
text(s,'Resize live: 1440 px → 390 px',.75,6.6,11.8,.5,24,PURPLE,True,0)

s=slide('Objects and events','Point to Package, Vehicle, and EcoCourier in js/models.js. Package holds the record and enforces ordered milestones; Vehicle handles battery; EcoCourier identifies the demo driver and cart. Show one event path in js/app.js: a submit/click handler calls change(), then rendering. No real authentication is claimed.')
heading(s,'What happens after a click?','THE MAIN CODE')
text(s,'Click or submit  →  Update data  →  Redraw the screen',.75,1.9,11.8,.75,27,PURPLE,True,0)
text(s,'Package',.85,3.25,4.1,.5,27,PURPLE,True,0)
text(s,'The delivery record\nand its allowed next step.',.85,4.05,3.8,1.2,22,space=400)
text(s,'Vehicle',5.0,3.25,3.4,.5,27,PURPLE,True,0)
text(s,'The cart and\nits battery level.',5.0,4.05,3.3,1.2,22,space=400)
text(s,'EcoCourier',9.05,3.25,3.4,.5,27,PURPLE,True,0)
text(s,'The driver\nclaiming the delivery.',9.05,4.05,3.5,1.2,22,space=400)
text(s,"pkg.advance('Loaded', shift.id);",.85,6.15,11.7,.65,25,PURPLE,False,0,'Consolas')

s=slide('Saved browser data','Refresh after confirming receipt. The receipt and history persist. localStorage stores versioned JSON; hydration restores the model methods. sessionStorage keeps the current tab shift. Storage events update other tabs on the same origin. All recipients share demo records, and changes are not shared across devices. Source: js/app.js load(), persist(), saveShift(), storage handler. Screenshot shows the tracked record after refresh.')
heading(s,'Refresh. The delivery is still there.','SIMULATED DATA')
image(s,'saved-tracking',.75,1.9,6.2,4.9,crop=(0,43000))
text(s,'The browser remembers.',7.45,2.4,5.0,1.3,31,PURPLE,True,0)
text(s,'Packages and history\nPreferences and receipts',7.45,4.15,5.1,1.5,23,space=1700)
text(s,'Same browser. Same address.\nNo backend connection yet.',7.45,6.0,5.1,.9,18,'666666',False,300)

s=slide('Progress and next phase','Final local verification on October 25 passed four model tests and eleven Chrome browser tests. This includes the connected journey, invalid input, storage failures, keyboard behavior, and responsive checks. Phase 3 still requires AJAX/JSON, Node.js, AngularJS, PHP/MySQL, durable data, and server-side validation/authentication. Do not claim submission, deployment, production security, or a measured emissions result. Source: docs/progress-report-2.md and assignment Tasks 3.1–3.4.')
heading(s,'Working now. Ready for the next step.')
text(s,'PHASE 2',.85,2.0,5.4,.35,17,PURPLE,True,0)
text(s,'Check in → Deliver → Sign',.85,2.7,11.7,.8,32,PURPLE,True,0)
text(s,'4 model tests + 11 browser tests passed',.85,3.9,11.4,.6,26,space=0)
text(s,'PHASE 3',.85,5.15,5.4,.35,17,'666666',True,0)
text(s,'Connect the backend and database.',.85,5.85,11.7,.7,30,PURPLE,True,0)
text(s,'Real accounts · server validation · permanent records',.85,6.72,11.7,.4,18,'666666',False,0)

# Retain the existing valid OOXML package structure and native editable text helper.
source = (ROOT / 'tools/build-presentation.py').read_text(encoding='utf-8')
source = source.replace("'CampusEco_Phase2_Technical_Presentation_1.pptx'", "'CampusEco_Phase2_Visual_Presentation.pptx'")
start=source.index('SLIDES = [')
end=source.index('\ntheme = ',start)
source=source[:start]+'SLIDES = '+repr(slides)+'\n'+source[end:]
start=source.index('for n, s in enumerate(SLIDES,1):')
end=source.index("    relations(f'ppt/slides/_rels/slide{n}.xml.rels',rels)",start)
render = '''for n, s in enumerate(SLIDES,1):
    shapes = ''
    rels=[('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','notesSlide',f'../notesSlides/notesSlide{n}.xml')]
    for index,item in enumerate(s['items'],2):
        if item['kind']=='text':
            shapes += textbox(index,'Editable text '+str(index),item['text'],item['x'],item['y'],item['w'],item['h'],size=item['size'],color=item['color'],bold=item['bold'],font=item['font'],space=item['space'])
        else:
            rid='rId'+str(len(rels)+1)
            shapes += picture(index,item['file'],rid,item['x'],item['y'],item['w'],item['h'],crop=item['crop'])
            rels.append((rid,'image','../media/'+item['file']))
            files['ppt/media/'+item['file']] = (ROOT/'docs/assets/phase2-visual'/item['file']).read_bytes()
    shade='FFFFFF' if s['background']!='FFFFFF' else '666666'
    shapes += textbox(99,'Slide number',str(n)+' / '+str(len(SLIDES)),12.1,7.08,.7,.25,size=10,color=shade,space=0)
    background='<p:bg><p:bgPr><a:solidFill><a:srgbClr val="'+s['background']+'"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>'
    put(f'ppt/slides/slide{n}.xml',f'<p:sld xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:cSld>{background}<p:spTree>{GROUP}{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
'''
source=source[:start]+render+source[end:]
exec(compile(source,str(ROOT/'tools/build-presentation.py'),'exec'),{'__file__':str(ROOT/'tools/build-presentation.py')})

# Matching HTML previews for visual layout review when no slide renderer is available.
preview=['<!doctype html><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#ddd}.slide{position:relative;width:1280px;height:720px;margin:0 0 20px;overflow:hidden}.text{position:absolute;white-space:normal}.text p{margin-top:0;line-height:1.18}.image{position:absolute;overflow:hidden}.image img{display:block;position:absolute;width:100%}</style>']
for n,s in enumerate(slides,1):
    preview.append(f'<section class="slide" id="slide-{n}" style="background:#{s["background"]}">')
    for i,it in enumerate(s['items']):
        geom=f'left:{it["x"]*96}px;top:{it["y"]*96}px;width:{it["w"]*96}px;height:{it["h"]*96}px;'
        if it['kind']=='text':
            style=geom+f'font-family:{it["font"]};font-size:{it["size"]}pt;color:#{it["color"]};font-weight:{700 if it["bold"] else 400}'
            preview.append(f'<div class="text" data-slide="{n}" style="{style}">'+''.join(f'<p style="margin-bottom:{it["space"]/100}pt">{html.escape(t)}</p>' for t in it['text'].split('\n'))+'</div>')
        else:
            top,bottom=it['crop']; frac=1-(top+bottom)/100000
            img=ASSETS/it['file']
            preview.append(f'<div class="image" style="{geom}"><img src="{img.as_uri()}" style="height:{100/frac}%;top:{-top/1000/frac}%"></div>')
    preview.append('</section>')
(BUILD/'preview.html').write_text(''.join(preview),encoding='utf-8')
(BUILD/'slides.json').write_text(json.dumps(slides,indent=2),encoding='utf-8')
print('Preview:', BUILD/'preview.html')

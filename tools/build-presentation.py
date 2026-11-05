"""Create an editable Office Open XML deck using the standard library.

Fallback for environments without the bundled presentation authoring runtime.
Text is native PowerPoint text; screenshots are embedded raster evidence.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
import xml.etree.ElementTree as ET
import posixpath

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output' / 'CampusEco_Phase2_Technical_Presentation_1.pptx'
OUT.parent.mkdir(exist_ok=True)
EMU = 914400
P = 'http://schemas.openxmlformats.org/presentationml/2006/main'
A = 'http://schemas.openxmlformats.org/drawingml/2006/main'
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
PURPLE = '49176D'
files = {}

def put(name, xml):
    files[name] = (HEAD + xml).encode('utf-8')

def relations(name, pairs):
    put(name, f'<Relationships xmlns="{REL}">' + ''.join(
        f'<Relationship Id="{rid}" Type="{R}/{kind}" Target="{target}"/>'
        for rid, kind, target in pairs) + '</Relationships>')

def transform(x, y, w, h):
    return f'<a:xfrm><a:off x="{round(x*EMU)}" y="{round(y*EMU)}"/><a:ext cx="{round(w*EMU)}" cy="{round(h*EMU)}"/></a:xfrm>'

GROUP = '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'

def paragraph(text, size, color='222222', bold=False, font='Arial', space=1200):
    return f'<a:p><a:pPr><a:lnSpc><a:spcPct val="118000"/></a:lnSpc><a:spcAft><a:spcPts val="{space}"/></a:spcAft></a:pPr><a:r><a:rPr lang="en-US" sz="{round(size*100)}" b="{int(bold)}"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill><a:latin typeface="{font}"/><a:ea typeface="{font}"/><a:cs typeface="{font}"/></a:rPr><a:t xml:space="preserve">{escape(text)}</a:t></a:r><a:endParaRPr lang="en-US" sz="{round(size*100)}"/></a:p>'

def textbox(id, name, text, x, y, w, h, size=23, color='222222', bold=False, font='Arial', space=1200):
    return f'<p:sp><p:nvSpPr><p:cNvPr id="{id}" name="{name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr>{transform(x,y,w,h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr><p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"><a:noAutofit/></a:bodyPr><a:lstStyle/>' + ''.join(paragraph(t,size,color,bold,font,space) for t in text.split('\n')) + '</p:txBody></p:sp>'

def picture(id, name, rid, x, y, w, h, crop=None):
    src = f'<a:srcRect t="{crop[0]}" b="{crop[1]}"/>' if crop else ''
    return f'<p:pic><p:nvPicPr><p:cNvPr id="{id}" name="{name}" descr="CampusEco browser screenshot"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="{rid}"/>{src}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>{transform(x,y,w,h)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'

SLIDES = [
    dict(title='MNSU-CampusEco', body='Technical Presentation 1\nPhase 2: Client interactivity and responsiveness',
         foot='CIS 483 • October 26, 2026', cover=True,
         notes='Introduce the shared campus logistics hub, student electric-cart crews, and campus recipients. Group: Misgana Kebede, Clement Mbuyi, Yonatan Alemayehu, Emran Abatemam. This presentation covers the local Phase 2 frontend. Source: CIS 483/583 Full Stack Project Description, Phase 2 Tasks 2.1–2.3.'),
    dict(title='The project and this checkpoint',
         body='One perimeter hub receives packages for campus buildings. Student crews complete the last part of the delivery using electric carts.\nPhase 1 established the HTML forms, navigation, sample logs, and campus styling.\nPhase 2 connects those screens with events, browser data, and responsive layouts.',
         notes='Brief project introduction. Explain that the package record now connects all three portals. Phase 1 was static. Phase 2 simulates the workflow in a browser without a production backend. Source: README.md, js/models.js, js/app.js.'),
    dict(title='Live walkthrough: one delivery',
         body='1. Hub: check in CE-20261004, 3.2 lb, 12 × 8 × 6 in.\n2. Crew: start ECO-1234 / cart-01 and claim the package.\n3. Update Loaded → En Route → Delivered.\n4. Recipient: track the number, sign receipt, then refresh.',
         foot='Open http://127.0.0.1:4173 • Keep a second portal tab open',
         notes='Start npm start before class. Reset the demo using Reset demo… → Restore sample data. Use a fictional recipient name. Show that form submissions do not reload the page. Keep an operator tab open to show cross-tab updates. Demonstrate a duplicate tracking number or the low-battery cart if time permits. Source: tests/browser/phase2.spec.cjs, README.md.'),
    dict(title='JavaScript objects and events',
         body='Package validates cargo, assigns a courier, enforces milestone order, and records a receipt.\nVehicle validates battery reports. EcoCourier represents a demo driver and cart.\nSubmit and click handlers call these methods, save state, then render the updated interface.',
         code="pkg.claim(shift, vehicle);\npkg.advance('Loaded', shift.id);\npkg.sign('Demo Recipient');",
         notes='Open js/models.js and show Package.claim, Package.advance, Package.sign, and Vehicle.reportBattery. In js/app.js, show form(), change(), and the delegated claim handler. Explain that claim, advance, and sign occur at separate steps; the snippet is a method overview, not one executable transaction. Native reportValidity() still guards form submission. Source: js/models.js; js/app.js.'),
    dict(title='jQuery updates the interface',
         body='Delegated clicks work on delivery rows added after page load.\nTracking rows and fleet cards are inserted dynamically.\nOptions slide open; the route marker animates between transit stages.',
         image='courier-desktop.png',
         foot='Official minified jQuery 3.7.1 is stored locally',
         notes='Show $(...).on() for form and click events, and the route queue delegated handler. Reveal Queue options and Edit preferences, then press Escape. Show .slideDown(), .slideUp(), and .animate(). User values are inserted with .text() rather than HTML. Reduced-motion preferences disable animation. Sources: js/app.js; https://api.jquery.com/on/ ; https://api.jquery.com/slideDown/ ; https://api.jquery.com/animate/ . Screenshot: docs/assets/courier-desktop.png, captured from this application.'),
    dict(title='Responsive tools for the crew',
         body='Desktop dashboard columns stack into a single column on phones.\nThe mobile route queue becomes readable, labeled delivery cards.\nNavigation wraps; wide hub logs scroll inside their own regions.',
         image='courier-phone.png', phone=True,
         foot='Viewport checks: 320, 390, 768, and 1440 pixels',
         notes='Resize the browser while showing the courier portal. Point out the two-column desktop workspace and single-column phone layout. Scroll to the queue and show each delivery as a card. At a small width, show that the hub tracking table scrolls without making the entire page overflow. Source: css/phase2.css, css/courier.css, browser viewport tests. Screenshot: docs/assets/courier-phone.png. The image is cropped to the queue area.'),
    dict(title='Simulated data before the backend',
         body='localStorage holds versioned package records, history, receipts, preferences, and the demo profile.\nsessionStorage keeps the current tab’s crew shift. Hydration restores model methods after refresh.\nStorage events refresh other portal tabs using the same browser origin.',
         foot='Browser-only simulation • No real authentication, email, GPS, or database',
         notes='Open DevTools Application → Local Storage and show campuseco.phase2.v2, using fictional data. Refresh to demonstrate persistence. Explain that all tabs must use the same hostname and port. Storage is device/browser specific and simultaneous writes are not transactional. Profiles and driver IDs are demo selectors, not real access control. Source: js/app.js, js/models.js, README.md.'),
    dict(title='Progress and verification',
         body='The connected journey works from package check-in through recipient sign-off.\n4 model tests and 11 Chrome browser tests passed in the final local run.\nChecks cover saved state, cross-tab updates, invalid input, battery limits, keyboard panels, and mobile layouts.',
         foot='Run npm test and npm run test:browser',
         notes='Tests were run on October 25, 2026. Explain why ordered status transitions and ownership checks matter. Show validation without claiming production security or full accessibility certification. Registration was also added to close the gap identified during the Phase 1 review. Source: tests/models.test.cjs, tests/browser/phase2.spec.cjs, docs/progress-report-2.md.'),
    dict(title='Remaining work: Phase 3',
         body='Replace browser storage with asynchronous JSON endpoints and durable database records.\nAdd the required Node.js, AngularJS, and PHP/MySQL integrations. Enforce validation and authentication on the server.\nThe current route is schematic and carbon metrics are illustrative; live services will require real data.',
         foot='Phase 2 checkpoint: interactive frontend, progress report, and technical presentation',
         notes='Explain the handoff rather than presenting backend features as finished. The current Node development server serves static files only; it is not the Phase 3 application backend. Phase 3 requirements come from the assignment Tasks 3.1–3.4. Do not claim D2L submission or instructor sign-off for Phase 2. The supplied PDF lists the Phase 2 presentation date but does not specify a talk duration. No precise D2L deadline is asserted here because it was not verified.'),
]

theme = f'''<a:theme xmlns:a="{A}" name="CampusEco"><a:themeElements><a:clrScheme name="CampusEco"><a:dk1><a:srgbClr val="222222"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="{PURPLE}"/></a:dk2><a:lt2><a:srgbClr val="F7F5FA"/></a:lt2>''' + ''.join(f'<a:accent{i}><a:srgbClr val="{c}"/></a:accent{i}>' for i,c in enumerate([PURPLE,'F2B700','388158','666666','BDA9CB','33104D'],1)) + '''<a:hlink><a:srgbClr val="49176D"/></a:hlink><a:folHlink><a:srgbClr val="33104D"/></a:folHlink></a:clrScheme><a:fontScheme name="Arial"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme><a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst>''' + ''.join('<a:ln w="9525"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/></a:ln>' for _ in range(3)) + '''</a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst>''' + ''.join('<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>' for _ in range(3)) + '</a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>'
put('ppt/theme/theme1.xml',theme)
cmap = '<p:clrMap accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" bg1="lt1" bg2="lt2" folHlink="folHlink" hlink="hlink" tx1="dk1" tx2="dk2"/>'
put('ppt/slideMasters/slideMaster1.xml',f'<p:sldMaster xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:cSld name="CampusEco"><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree>{GROUP}</p:spTree></p:cSld>{cmap}<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>')
relations('ppt/slideMasters/_rels/slideMaster1.xml.rels',[('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','theme','../theme/theme1.xml')])
put('ppt/slideLayouts/slideLayout1.xml',f'<p:sldLayout xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree>{GROUP}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>')
relations('ppt/slideLayouts/_rels/slideLayout1.xml.rels',[('rId1','slideMaster','../slideMasters/slideMaster1.xml')])
put('ppt/notesMasters/notesMaster1.xml',f'<p:notesMaster xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:cSld><p:spTree>{GROUP}</p:spTree></p:cSld>{cmap}<p:notesStyle/></p:notesMaster>')
relations('ppt/notesMasters/_rels/notesMaster1.xml.rels',[('rId1','theme','../theme/theme1.xml')])

for n, s in enumerate(SLIDES,1):
    cover=s.get('cover',False)
    shapes = textbox(2,'Slide title',s['title'],.72,1.6 if cover else .56,11.85,1.0,size=46 if cover else 32,color=PURPLE,bold=True)
    if cover:
        shapes+=textbox(3,'Subtitle',s['body'],.76,2.95,11.7,1.4,size=26)
        shapes+=textbox(4,'Group members','Misgana Kebede • Clement Mbuyi\nYonatan Alemayehu • Emran Abatemam',.76,5.15,11.7,.95,size=19,color='666666')
    elif s.get('image'):
        shapes+=textbox(3,'Explanation',s['body'],.76,1.8,6.0,4.4,size=23,space=1800)
        if s.get('phone'):
            shapes+=picture(4,'Mobile courier queue','rId3',8.35,1.65,2.3,4.85,crop=(35500,35500))
        else:
            shapes+=picture(4,'Desktop courier dashboard','rId3',7.13,1.85,5.45,3.41)
    elif s.get('code'):
        shapes+=textbox(3,'Model responsibilities',s['body'],.76,1.72,11.7,3.05,size=23,space=1500)
        shapes+=textbox(4,'Model method examples',s['code'],.9,5.0,11.5,1.35,size=19,color=PURPLE,font='Consolas',space=200)
    else:
        shapes+=textbox(3,'Slide content',s['body'],.76,1.8,11.65,4.65,size=25,space=2100)
    foot=s.get('foot','')
    if foot: shapes+=textbox(8,'Slide context',foot,.76,6.75,11.5,.35,size=14,color='666666',space=0)
    shapes+=textbox(9,'Slide number',f'{n} / {len(SLIDES)}',12.0,7.08,.65,.25,size=11,color='666666',space=0)
    put(f'ppt/slides/slide{n}.xml',f'<p:sld xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:cSld><p:spTree>{GROUP}{shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
    rels=[('rId1','slideLayout','../slideLayouts/slideLayout1.xml'),('rId2','notesSlide',f'../notesSlides/notesSlide{n}.xml')]
    if s.get('image'):
        rels.append(('rId3','image','../media/'+s['image']))
        files['ppt/media/'+s['image']]=(ROOT/'docs'/'assets'/s['image']).read_bytes()
    relations(f'ppt/slides/_rels/slide{n}.xml.rels',rels)
    note_shape=textbox(2,'Speaker notes',s['notes'],.7,1,6,8,size=14).replace('<p:nvPr/>','<p:nvPr><p:ph type="body" idx="1"/></p:nvPr>')
    put(f'ppt/notesSlides/notesSlide{n}.xml',f'<p:notes xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:cSld><p:spTree>{GROUP}{note_shape}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>')
    relations(f'ppt/notesSlides/_rels/notesSlide{n}.xml.rels',[('rId1','notesMaster','../notesMasters/notesMaster1.xml'),('rId2','slide',f'../slides/slide{n}.xml')])

put('ppt/presentation.xml',f'<p:presentation xmlns:a="{A}" xmlns:r="{R}" xmlns:p="{P}"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId2"/></p:notesMasterIdLst><p:sldIdLst>'+''.join(f'<p:sldId id="{255+i}" r:id="rId{i+2}"/>' for i in range(1,len(SLIDES)+1))+'</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="screen16x9"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle/></p:presentation>')
relations('ppt/_rels/presentation.xml.rels',[('rId1','slideMaster','slideMasters/slideMaster1.xml'),('rId2','notesMaster','notesMasters/notesMaster1.xml')]+[(f'rId{i+2}','slide',f'slides/slide{i}.xml') for i in range(1,len(SLIDES)+1)])
put('docProps/core.xml','<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>CampusEco — Technical Presentation 1</dc:title><dc:subject>Phase 2 frontend interactivity and responsive design</dc:subject><dc:creator>CampusEco Group</dc:creator></cp:coreProperties>')
put('docProps/app.xml',f'<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>CampusEco Presentation Builder</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>{len(SLIDES)}</Slides><Notes>{len(SLIDES)}</Notes></Properties>')
relations('_rels/.rels',[('rId1','officeDocument','ppt/presentation.xml')])
# Core/app property relationship types live in separate namespaces.
files['_rels/.rels']=(HEAD+f'<Relationships xmlns="{REL}"><Relationship Id="rId1" Type="{R}/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="{R}/extended-properties" Target="docProps/app.xml"/></Relationships>').encode()
overrides={'ppt/presentation.xml':'presentation','ppt/slideMasters/slideMaster1.xml':'slideMaster','ppt/slideLayouts/slideLayout1.xml':'slideLayout','ppt/notesMasters/notesMaster1.xml':'notesMaster','ppt/theme/theme1.xml':'theme'}
for i in range(1,len(SLIDES)+1):
    overrides[f'ppt/slides/slide{i}.xml']='slide'
    overrides[f'ppt/notesSlides/notesSlide{i}.xml']='notesSlide'
content_types='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'
for name,kind in overrides.items():
    mime='application/vnd.openxmlformats-officedocument.'+('theme+xml' if kind=='theme' else f'presentationml.{kind}+xml')
    if kind=='presentation': mime='application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml'
    content_types+=f'<Override PartName="/{name}" ContentType="{mime}"/>'
content_types+='<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'
put('[Content_Types].xml',content_types)

# Verify every XML part and every internal relationship before writing the deck.
for name,body in files.items():
    if name.endswith(('.xml','.rels')): ET.fromstring(body)
    if name.endswith('.rels'):
        parent=posixpath.dirname(name).replace('/_rels','') if name!='_rels/.rels' else ''
        for relation in ET.fromstring(body):
            target=posixpath.normpath(posixpath.join(parent,relation.attrib['Target']))
            assert target in files, (name,target)
with ZipFile(OUT,'w',ZIP_DEFLATED) as archive:
    for name,body in files.items(): archive.writestr(name,body)
print(f'Created {OUT} ({len(SLIDES)} editable slides with speaker notes)')

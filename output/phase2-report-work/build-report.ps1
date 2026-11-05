$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
Add-Type -AssemblyName System.Drawing
$root='C:/Users/misga/Desktop/cis483/mnsu-campuseco'
$reference='C:/Users/misga/Downloads/MNSU_CampusEco_Phase1_Progress_Report_Final (1).docx'
$out="$root/output/MNSU_CampusEco_Phase2_Progress_Report.docx"
$work="$root/output/phase2-report-work"
$sourceHash=(Get-FileHash -LiteralPath $reference -Algorithm SHA256).Hash
$zip=[IO.Compression.ZipFile]::OpenRead($reference)
$parts=@{}
foreach($entry in $zip.Entries){$ms=[IO.MemoryStream]::new();$stream=$entry.Open();$stream.CopyTo($ms);$stream.Dispose();$parts[$entry.FullName]=$ms.ToArray();$ms.Dispose()}
$zip.Dispose()
[xml]$xml=[Text.Encoding]::UTF8.GetString($parts['word/document.xml'])
$ns=[Xml.XmlNamespaceManager]::new($xml.NameTable)
$ns.AddNamespace('w','http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$ns.AddNamespace('a','http://schemas.openxmlformats.org/drawingml/2006/main')
$ns.AddNamespace('wp','http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing')
$ns.AddNamespace('pic','http://schemas.openxmlformats.org/drawingml/2006/picture')
$body=$xml.SelectSingleNode('//w:body',$ns)
$old=@($body.ChildNodes)
$title=$old[0].CloneNode($true);$subtitle=$old[1].CloneNode($true)
$heading=$old[2].CloneNode($true);$subheading=$old[7].CloneNode($true)
$tables=@($body.SelectNodes('w:tbl',$ns))
$draw=$body.SelectSingleNode('w:p[.//w:drawing]',$ns).CloneNode($true)
$caption=$old[20].CloneNode($true)
$section=$body.SelectSingleNode('w:sectPr',$ns).CloneNode($true)
foreach($n in @($body.ChildNodes)){[void]$body.RemoveChild($n)}
function Set-Text($node,[string]$text){
  $p=if($node.LocalName -eq 'p'){$node}else{$node.SelectSingleNode('.//w:p',$ns)}
  $run=$p.SelectSingleNode('w:r',$ns)
  if(!$run){$run=$xml.CreateElement('w','r',$ns.LookupNamespace('w'))}
  $run=$run.CloneNode($true)
  foreach($c in @($run.ChildNodes)){if($c.LocalName -ne 'rPr'){[void]$run.RemoveChild($c)}}
  $t=$xml.CreateElement('w','t',$ns.LookupNamespace('w'));$t.InnerText=$text;[void]$run.AppendChild($t)
  foreach($c in @($p.ChildNodes)){if($c.LocalName -ne 'pPr'){[void]$p.RemoveChild($c)}}
  [void]$p.AppendChild($run)
}
function Add-Node($n){[void]$body.AppendChild($n)}
function Para([string]$text,[string]$kind='body'){
  $p=switch($kind){'title'{$title.CloneNode($true)} 'subtitle'{$subtitle.CloneNode($true)} 'heading'{$heading.CloneNode($true)} 'subheading'{$subheading.CloneNode($true)} 'caption'{$caption.CloneNode($true)} default{$tables[1].SelectSingleNode('w:tr[2]/w:tc[2]/w:p',$ns).CloneNode($true)}}
  Set-Text $p $text
  if($kind -in @('heading','subheading')){ $pr=$p.SelectSingleNode('w:pPr',$ns);if(!$pr){$pr=$xml.CreateElement('w','pPr',$ns.LookupNamespace('w'));[void]$p.PrependChild($pr)};[void]$pr.AppendChild($xml.CreateElement('w','keepNext',$ns.LookupNamespace('w'))) }
  Add-Node $p
}
function Break-Page{
  $p=$xml.CreateElement('w','p',$ns.LookupNamespace('w'));$r=$xml.CreateElement('w','r',$ns.LookupNamespace('w'));$b=$xml.CreateElement('w','br',$ns.LookupNamespace('w'));$b.SetAttribute('type',$ns.LookupNamespace('w'),'page');[void]$r.AppendChild($b);[void]$p.AppendChild($r);Add-Node $p
}
function Table($template,$headers,$rows){
  $tbl=$template.CloneNode($true);$originalRows=@($tbl.SelectNodes('w:tr',$ns));$header=$originalRows[0].CloneNode($true);$pattern=$originalRows[1].CloneNode($true)
  foreach($r in @($tbl.SelectNodes('w:tr',$ns))){[void]$tbl.RemoveChild($r)}
  $cells=@($header.SelectNodes('w:tc',$ns));for($i=0;$i -lt $headers.Count;$i++){Set-Text $cells[$i] $headers[$i]};[void]$tbl.AppendChild($header)
  foreach($values in $rows){$row=$pattern.CloneNode($true);$cells=@($row.SelectNodes('w:tc',$ns));for($i=0;$i -lt $values.Count;$i++){Set-Text $cells[$i] $values[$i]};[void]$tbl.AppendChild($row)}
  Add-Node $tbl
  Para ''
}
$script:picIndex=0
function Picture([string]$file,[double]$width){
  $script:picIndex++;$id=$script:picIndex
  $p=$draw.CloneNode($true)
  foreach($n in @($p.ChildNodes)){if($n.LocalName -ne 'pPr' -and !$n.SelectSingleNode('.//w:drawing',$ns)){[void]$p.RemoveChild($n)}}
  foreach($n in @($p.SelectNodes('.//w:t',$ns))){[void]$n.ParentNode.RemoveChild($n)}
  $img=[Drawing.Image]::FromFile("$root/docs/assets/phase2-visual/$file")
  $cx=[long]($width*914400);$cy=[long]($cx*$img.Height/$img.Width);$img.Dispose()
  foreach($e in $p.SelectNodes('.//wp:extent | .//a:ext',$ns)){$e.SetAttribute('cx',[string]$cx);$e.SetAttribute('cy',[string]$cy)}
  $blip=$p.SelectSingleNode('.//a:blip',$ns);$rid='rId'+($id+7);$blip.SetAttribute('embed','http://schemas.openxmlformats.org/officeDocument/2006/relationships',$rid)
  foreach($e in $p.SelectNodes('.//wp:docPr | .//pic:cNvPr',$ns)){$e.SetAttribute('id',[string](500+$id));$e.SetAttribute('name',$file);$e.SetAttribute('descr','CampusEco Phase 2 interface '+$file)}
  $parts["word/media/image$id.png"]=[IO.File]::ReadAllBytes("$root/docs/assets/phase2-visual/$file")
  Add-Node $p
}
Para 'CIS 483 Progress Report 2 Phase 2 Interactive Frontend' 'title'
Para 'MNSU-CampusEco | October 26, 2026' 'subtitle'
Para '1 Report header' 'heading'
Table $tables[0] @('Item','Details') @(
  ,@('Group name / number','MNSU-CampusEco')
  ,@('Members (full names)','Yonatan Alemayehu; Misgana Kebede; Clement Mbuyi; Emran Abatemam')
  ,@('Course','CIS 483')
  ,@('Progress Report #','2')
  ,@('Phase','Phase 2 Interactive Frontend')
  ,@('Report date','October 26, 2026')
  ,@('GitHub repository link','github.com/mnsu-campuseco/mnsu-campuseco')
  ,@('Checkpoint commit or tag','Phase 2 working tree; latest committed baseline 0ff51d5. Phase 2 commit/tag pending.')
)
Para 'The Phase 1 static portals now support a complete browser-based delivery workflow. A hub operator checks in a package, a crew member claims and delivers it, and the recipient tracks the package and confirms receipt. JavaScript and jQuery update the interface without a full-page form reload. Browser storage retains records after refresh and synchronizes other portal tabs on the same origin.'
Para 'Phase 2 covers JavaScript objects and events, jQuery integration, and mobile-first responsive design. The application remains a frontend demonstration; authentication, database storage, and server endpoints are planned for Phase 3.'
Break-Page
Para '2 Work completed this phase' 'heading'
Para 'Phase 2 Interactive Frontend' 'subheading'
Table $tables[1] @('Item','What we implemented and source files','Status') @(
  ,@('JavaScript objects and rules','js/models.js defines Package, Vehicle, and EcoCourier. Validation covers cargo, IDs, battery limits, claim ownership, ordered milestones, and a single receipt after delivery.','Done')
  ,@('Functions and DOM events','js/app.js handles check-in, crew shifts, claims, milestones, tracking, preferences, registration, and receipt forms. Submit handlers preserve native validation and update the DOM without navigation.','Done')
  ,@('Browser persistence','Versioned localStorage saves the shared dataset; sessionStorage retains the current tab shift. Hydration restores model methods. Storage events refresh other same-origin tabs.','Done')
  ,@('jQuery integration','Local js/vendor/jquery-3.7.1.min.js loads before the models/controller. Selectors, .on(), delegated clicks, dynamic rows, sliding panels, and an animated route marker drive the interface.','Done')
  ,@('Responsive design','css/phase2.css starts with one column and adds layouts at 420, 600, and 900 px. Navigation wraps; the mobile courier queue uses cards; wide logs and history scroll inside containers.','Done')
  ,@('Validation and interaction checks','tests/models.test.cjs and tests/browser/phase2.spec.cjs cover business rules, portal workflow, persistence, storage recovery, input safety, keyboard behavior, and responsive layouts.','Passed')
)
Para 'Verification on October 26, 2026 passed 4 model tests and 11 Chrome browser tests using npm test and npm run test:browser. Responsive tests cover the landing page and all portals at 320, 390, 768, and 1440 pixels. The browser suite also checks presentation navigation and slide geometry.'
Para 'Presentation materials are available in docs/presentation.html and docs/presentation-notes.md. README.md documents setup, demo steps, the requirement map, and the frontend boundaries.'
Break-Page
Para '3 Screenshots' 'heading'
Para 'Landing page and Hub Operator portal' 'subheading'
Picture 'home.png' 5.5
Para 'Figure 1: Landing page with portal navigation, browser totals, and demonstration guidance.' 'caption'
Picture 'new-row.png' 6.5
Para 'Figure 2: Hub tracking log showing the newly checked-in package CE-20261004.' 'caption'
Para 'The operator enters a tracking number, weight, dimensions, campus destination, and optional urgent priority. Duplicate tracking numbers are rejected. Search and status filters narrow the shared tracking log.'
Break-Page
Para 'Eco Transit Crew portal' 'subheading'
Picture 'claim-queue.png' 6.5
Para 'Figure 3: Delivery queue with claim controls, priority, destination, and assigned driver.' 'caption'
Picture 'route-marker.png' 6.5
Para 'Figure 4: Route preview uses a schematic cart marker to show the selected transit stage.' 'caption'
Picture 'milestone.png' 2.8
Para 'Figure 5: Milestone reporting follows Loaded, En Route, then Delivered.' 'caption'
Para 'Crew members start a demo shift with a driver ID and cart. Carts require at least 20% battery to claim new work. Only the assigned courier can advance a package; active deliveries must be completed before changing carts or ending a shift.'
Break-Page
Para 'Campus End User portal' 'subheading'
Picture 'tracking.png' 3.65
Para 'Figure 6: Tracking lookup displays the package status and timestamped delivery history.' 'caption'
Picture 'receipt.png' 3.65
Para 'Figure 7: A recipient can confirm receipt after delivery.' 'caption'
Para 'The portal also saves delivery preferences and a demo profile, filters in-app notifications, and calculates illustrative carbon savings. Each completed delivery contributes 2 km multiplied by 0.20 kg of avoided CO2 per km. No email or real authentication is provided.'
Break-Page
Para '4 Problems and next steps' 'heading'
Table $tables[2] @('Problem or limitation','Solution or next step') @(
  ,@('Shared state across separate portals','Use a versioned dataset, reread state before mutations, and refresh other tabs through storage events. Simultaneous writes are not transactional; Phase 3 needs server coordination.')
  ,@('Blocked or unreadable browser storage','Display a warning and use page memory when storage is unavailable. Corrupt saved data blocks writes until an explicit scoped demo reset.')
  ,@('Invalid or out-of-order delivery actions','Enforce duplicate prevention, driver ownership, a 20% claim battery threshold, sequential status changes, and one receipt per delivered package.')
  ,@('Small-screen queues and wide tables','Use mobile delivery cards, wrapped navigation, responsive columns, and internal scrolling for logs/history. Controls have at least 44 px height.')
  ,@('Demo identities and local data only','Phase 3 should add authenticated endpoints, server validation, a durable relational database, and asynchronous UI updates. Route and carbon results remain illustrative.')
)
Para 'Planned work for Phase 3' 'subheading'
Table $tables[3] @('Planned for the next phase','Proposed review owner') @(
  ,@('Connect package check-in and tracking logs to authenticated server endpoints.','Misgana Kebede')
  ,@('Connect recipient tracking, preferences, notifications, and receipt records to durable storage.','Emran Abatemam')
  ,@('Connect crew assignment, fleet data, and delivery transitions to server-side business rules.','Clement Mbuyi')
  ,@('Coordinate shared API/database integration, repository checkpoint, and documentation.','Yonatan Alemayehu')
)
Break-Page
Para '5 Team contributions' 'heading'
Para 'Phase 1 assigned the portal ownership shown below. These areas provide the Phase 2 review roster; the team should confirm individual Phase 2 implementation and commit attribution before submission.'
Table $tables[4] @('Member','Assigned area and Phase 2 review scope') @(
  ,@('Yonatan Alemayehu','Shared frontend and integration: index.html, css/main.css, css/phase2.css, README.md, shared models/controller, tests, report, and presentation integration.')
  ,@('Misgana Kebede','Hub Operator: pages/operator.html and css/operator.css; review package check-in, validation, duplicate prevention, shared tracking log, totals, and filters.')
  ,@('Clement Mbuyi','Eco-Transit Crew: pages/courier.html and css/courier.css; review shifts, cart/battery selection, claiming, ownership, milestone order, queue filters, and route preview.')
  ,@('Emran Abatemam','Campus End-User: pages/enduser.html and css/enduser.css; review tracking/history, preferences, demo registration, notification filters, receipt confirmation, and carbon metrics.')
)
Para 'The shared model/controller supports all portals. The current Phase 2 implementation is present in the working tree, while the latest committed baseline is the Phase 1 commit 0ff51d5. Record the final Phase 2 commit or tag after the team reviews and commits the deliverables.'
Para 'Team review and submission' 'subheading'
Para 'Review the end-to-end demonstration, confirm individual contributions, and rehearse Technical Presentation 1. The Phase 2 due date is October 26, 2026. One member should submit the compiled report, presentation materials, and repository link through D2L.'
Add-Node $section
# Discard cached pagination marks and preserve every nonedited package part.
foreach($n in @($xml.SelectNodes('//w:lastRenderedPageBreak',$ns))){[void]$n.ParentNode.RemoveChild($n)}
$parts['word/document.xml']=[Text.Encoding]::UTF8.GetBytes($xml.OuterXml)
$footer=[Text.Encoding]::UTF8.GetString($parts['word/footer1.xml'])
$footer=$footer.Replace('Progress Report 1','Progress Report 2')
$parts['word/footer1.xml']=[Text.Encoding]::UTF8.GetBytes($footer)
if(Test-Path -LiteralPath $out){[IO.File]::Delete($out)}
$target=[IO.Compression.ZipFile]::Open($out,[IO.Compression.ZipArchiveMode]::Create)
foreach($name in $parts.Keys){$entry=$target.CreateEntry($name,[IO.Compression.CompressionLevel]::Optimal);$stream=$entry.Open();$bytes=$parts[$name];$stream.Write($bytes,0,$bytes.Length);$stream.Dispose()}
$target.Dispose()
if((Get-FileHash -LiteralPath $reference -Algorithm SHA256).Hash -ne $sourceHash){throw 'Reference changed'}
@"
# Phase 2 report template contract
Reference: $reference
SHA256: $sourceHash
Reference cached pages: 9. Sections: 1.
Geometry: Letter 12240 x 15840 twips; margins top/bottom 864, left/right 936; footer/header 720.
Typography: retained styles, Calibri default 11 pt, default after 160 twips and line 259; centered Title and subtitle; source Heading1/Heading2 and italic captions.
Tables: source TableGrid, purple 49176D headers with white bold type, original cell widths and row properties. Cloned rows expand to fit.
Structure: report header, work completed, screenshots, problems and next steps, team contributions. Added source-derived screenshot and row patterns as needed.
Editable slots: document body paragraphs/tables/drawings, image1 through image7. Preserve all other ZIP parts byte for byte, including styles, numbering, theme, footer, relationships, footnotes and endnotes.
Images: source inline drawing pattern, aspect ratio preserved, unique IDs, meaningful descriptions. Phase 2 repo screenshots replace Phase 1 screenshots.
Final pagination planned: seven pages with explicit section breaks between content groups. Retained PAGE footer.
Attribution: ownership carried forward as review scope; no unverified Phase 2 authorship assigned.
Runtime: workspace dependency loader and bundled rendering runtime unavailable in this Windows session. Uses native .NET ZIP/XML to patch the retained package.
"@ | Set-Content -LiteralPath "$work/artifact.md" -Encoding UTF8
Write-Output $out

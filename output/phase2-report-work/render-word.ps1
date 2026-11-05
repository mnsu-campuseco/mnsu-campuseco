$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$base='C:\Users\misga\Desktop\cis483\mnsu-campuseco\output'
$w=New-Object -ComObject Word.Application
$w.Visible=$false
$w.DisplayAlerts=0
$d=$w.Documents.Open("$base\MNSU_CampusEco_Phase2_Progress_Report.docx",$false,$true)
$d.Repaginate()
Write-Output ('Pages: '+$d.ComputeStatistics(2))
$d.ExportAsFixedFormat("$base\phase2-report-work\preview.pdf",17)
$pages=$w.ActiveWindow.Panes.Item(1).Pages
for($i=1;$i -le $pages.Count;$i++){
  [byte[]]$bits=$pages.Item($i).EnhMetaFileBits
  $ms=[IO.MemoryStream]::new($bits,0,$bits.Length)
  $img=[Drawing.Image]::FromStream($ms)
  $bitmap=[Drawing.Bitmap]::new(1275,1650)
  $g=[Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([Drawing.Color]::White)
  $g.DrawImage($img,0,0,1275,1650)
  $bitmap.Save("$base\phase2-report-work\page-$i.png",[Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose();$bitmap.Dispose();$img.Dispose();$ms.Dispose()
}
$d.Close(0)
$w.Quit()

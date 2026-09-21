Add-Type -AssemblyName System.Drawing
$srcPath = Resolve-Path "public/logo.png"
$src = [System.Drawing.Image]::FromFile($srcPath)

function Resize-Image($img, $w, $h, $outPath) {
    $dest = New-Object System.Drawing.Bitmap($w, $h)
    $g = [System.Drawing.Graphics]::FromImage($dest)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($img, 0, 0, $w, $h)
    $dest.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $dest.Dispose()
    Write-Host "Created $outPath ($w x $h)"
}

Resize-Image $src 48 48 "public/favicon-48x48.png"
Resize-Image $src 96 96 "public/favicon-96x96.png"
Resize-Image $src 192 192 "public/logo192.png"
Resize-Image $src 512 512 "public/logo512.png"

$src.Dispose()

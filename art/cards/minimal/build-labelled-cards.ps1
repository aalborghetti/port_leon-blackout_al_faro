param(
    [string]$SourceDirectory = $PSScriptRoot,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'labelled')
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Drawing

$cardWidth = 1060
$cardHeight = 1484
$illustrationHeight = 1215
$separatorY = 1240
$safeMargin = 85
$fontSize = 62
$standardTracking = 4.3
$compactTracking = 2.5

$roles = [ordered]@{
    'custode.png'                = 'CUSTODE'
    'sabotatore.png'             = 'SABOTATORE'
    'sentinella.png'             = 'SENTINELLA'
    'tecnico.png'                = 'TECNICO'
    'portavoce.png'              = 'PORTAVOCE'
    'naufrago.png'               = 'NAUFRAGO'
    'vedetta.png'                = 'VEDETTA'
    'cartografa-della-baia.png'  = 'CARTOGRAFA DELLA BAIA'
    'guastatore.png'             = 'GUASTATORE'
}

$navy = [System.Drawing.Color]::FromArgb(20, 54, 87)

function Get-EdgeColor {
    param([System.Drawing.Bitmap]$Bitmap)

    $points = @(
        [System.Drawing.Point]::new(0, 0),
        [System.Drawing.Point]::new($Bitmap.Width - 1, 0),
        [System.Drawing.Point]::new(0, $Bitmap.Height - 1),
        [System.Drawing.Point]::new($Bitmap.Width - 1, $Bitmap.Height - 1)
    )

    $red = 0
    $green = 0
    $blue = 0
    foreach ($point in $points) {
        $pixel = $Bitmap.GetPixel($point.X, $point.Y)
        $red += $pixel.R
        $green += $pixel.G
        $blue += $pixel.B
    }

    return [System.Drawing.Color]::FromArgb(
        [int][Math]::Round($red / $points.Count),
        [int][Math]::Round($green / $points.Count),
        [int][Math]::Round($blue / $points.Count)
    )
}

function Get-TrackedTextWidth {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [float]$Tracking,
        [System.Drawing.StringFormat]$Format
    )

    $width = 0.0
    foreach ($character in $Text.ToCharArray()) {
        $width += $Graphics.MeasureString(
            [string]$character,
            $Font,
            [System.Drawing.PointF]::Empty,
            $Format
        ).Width
    }

    if ($Text.Length -gt 1) {
        $width += $Tracking * ($Text.Length - 1)
    }

    return $width
}

function Draw-TrackedText {
    param(
        [System.Drawing.Graphics]$Graphics,
        [string]$Text,
        [System.Drawing.Font]$Font,
        [System.Drawing.Brush]$Brush,
        [float]$Tracking,
        [float]$CenterX,
        [float]$Y,
        [System.Drawing.StringFormat]$Format
    )

    $totalWidth = Get-TrackedTextWidth $Graphics $Text $Font $Tracking $Format
    $x = $CenterX - ($totalWidth / 2)

    foreach ($character in $Text.ToCharArray()) {
        $glyph = [string]$character
        $Graphics.DrawString($glyph, $Font, $Brush, $x, $Y, $Format)
        $x += $Graphics.MeasureString(
            $glyph,
            $Font,
            [System.Drawing.PointF]::Empty,
            $Format
        ).Width + $Tracking
    }
}

[System.IO.Directory]::CreateDirectory($OutputDirectory) | Out-Null

$font = [System.Drawing.Font]::new(
    'Segoe UI Semibold',
    $fontSize,
    [System.Drawing.FontStyle]::Regular,
    [System.Drawing.GraphicsUnit]::Pixel
)
$textFormat = [System.Drawing.StringFormat]::GenericTypographic.Clone()
$textFormat.FormatFlags = $textFormat.FormatFlags -bor [System.Drawing.StringFormatFlags]::MeasureTrailingSpaces
$navyBrush = [System.Drawing.SolidBrush]::new($navy)
$separatorPen = [System.Drawing.Pen]::new($navy, 5)
$imageAttributes = [System.Drawing.Imaging.ImageAttributes]::new()
$imageAttributes.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)

try {
    foreach ($entry in $roles.GetEnumerator()) {
        $sourcePath = Join-Path $SourceDirectory $entry.Key
        if (-not (Test-Path -LiteralPath $sourcePath)) {
            throw "Immagine sorgente mancante: $sourcePath"
        }

        $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
        try {
            $background = Get-EdgeColor $source
            $output = [System.Drawing.Bitmap]::new(
                $cardWidth,
                $cardHeight,
                [System.Drawing.Imaging.PixelFormat]::Format32bppPArgb
            )
            $output.SetResolution(427, 427)

            try {
                $graphics = [System.Drawing.Graphics]::FromImage($output)
                try {
                    $graphics.Clear($background)
                    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
                    $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

                    $widthScale = [double]$cardWidth / [double]$source.Width
                    $heightScale = [double]$illustrationHeight / [double]$source.Height
                    $scale = [Math]::Min($widthScale, $heightScale)
                    $drawWidth = [int][Math]::Round($source.Width * $scale)
                    $drawHeight = [int][Math]::Round($source.Height * $scale)
                    $drawX = [int][Math]::Round(($cardWidth - $drawWidth) / 2)
                    $drawY = [int][Math]::Round(($illustrationHeight - $drawHeight) / 2)

                    $destination = [System.Drawing.Rectangle]::new(
                        $drawX,
                        $drawY,
                        $drawWidth,
                        $drawHeight
                    )
                    $graphics.DrawImage(
                        $source,
                        $destination,
                        0,
                        0,
                        $source.Width,
                        $source.Height,
                        [System.Drawing.GraphicsUnit]::Pixel,
                        $imageAttributes
                    )

                    $graphics.DrawLine(
                        $separatorPen,
                        $safeMargin,
                        $separatorY,
                        $cardWidth - $safeMargin,
                        $separatorY
                    )

                    $title = [string]$entry.Value
                    $tracking = $standardTracking
                    $maxTitleWidth = $cardWidth - (2 * $safeMargin)
                    $titleWidth = Get-TrackedTextWidth $graphics $title $font $tracking $textFormat
                    if ($titleWidth -gt $maxTitleWidth) {
                        $tracking = $compactTracking
                        $titleWidth = Get-TrackedTextWidth $graphics $title $font $tracking $textFormat
                    }
                    if ($titleWidth -gt $maxTitleWidth) {
                        throw "Il titolo '$title' supera la zona sicura."
                    }

                    $titleHeight = $graphics.MeasureString(
                        $title,
                        $font,
                        [System.Drawing.PointF]::Empty,
                        $textFormat
                    ).Height
                    $titleAreaTop = $separatorY + 5
                    $titleY = $titleAreaTop + (($cardHeight - $titleAreaTop - $titleHeight) / 2)

                    Draw-TrackedText `
                        $graphics `
                        $title `
                        $font `
                        $navyBrush `
                        $tracking `
                        ($cardWidth / 2) `
                        $titleY `
                        $textFormat
                }
                finally {
                    $graphics.Dispose()
                }

                $outputPath = Join-Path $OutputDirectory $entry.Key
                $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $output.Dispose()
            }
        }
        finally {
            $source.Dispose()
        }
    }
}
finally {
    $imageAttributes.Dispose()
    $separatorPen.Dispose()
    $navyBrush.Dispose()
    $textFormat.Dispose()
    $font.Dispose()
}

Write-Output "Create $($roles.Count) carte in: $OutputDirectory"

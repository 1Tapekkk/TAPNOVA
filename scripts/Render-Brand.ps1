param([switch]$Preview)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName PresentationCore, PresentationFramework, WindowsBase
$projectRoot = Split-Path -Parent $PSScriptRoot
$brandRoot = Join-Path $projectRoot 'Resources\Brand'
$iconRoot = Join-Path $projectRoot 'Resources\Extension\icons'
[IO.Directory]::CreateDirectory($iconRoot) | Out-Null
$theme = [Windows.Markup.XamlReader]::Parse([IO.File]::ReadAllText((Join-Path $brandRoot 'Theme.xaml')))
function Save-Png($visual, [int]$width, [int]$height, [string]$path) {
    $bitmap = [Windows.Media.Imaging.RenderTargetBitmap]::new($width, $height, 96, 96, [Windows.Media.PixelFormats]::Pbgra32)
    $bitmap.Render($visual)
    $encoder = [Windows.Media.Imaging.PngBitmapEncoder]::new()
    $encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $stream = [IO.File]::Create($path)
    try { $encoder.Save($stream) } finally { $stream.Dispose() }
}
$sizes = @(16, 32, 48, 64, 128, 256)
$frames = @()
foreach ($size in $sizes) {
    $visual = [Windows.Media.DrawingVisual]::new()
    $context = $visual.RenderOpen()
    $context.DrawImage($theme['BrandMark'], [Windows.Rect]::new(0, 0, $size, $size))
    $context.Close()
    $pngPath = Join-Path $iconRoot "tapnova-$size.png"
    Save-Png $visual $size $size $pngPath
    $frames += ,([IO.File]::ReadAllBytes($pngPath))
}
$writer = [IO.BinaryWriter]::new([IO.File]::Create((Join-Path $brandRoot 'tapnova.ico')))
try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$sizes.Count)
    $offset = 6 + 16 * $sizes.Count
    for ($i = 0; $i -lt $sizes.Count; $i++) {
        $dimension = if ($sizes[$i] -eq 256) { 0 } else { $sizes[$i] }
        $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
        $writer.Write([byte]0); $writer.Write([byte]0)
        $writer.Write([uint16]1); $writer.Write([uint16]32)
        $writer.Write([uint32]$frames[$i].Length); $writer.Write([uint32]$offset)
        $offset += $frames[$i].Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame) }
} finally { $writer.Dispose() }
Copy-Item -LiteralPath (Join-Path $iconRoot 'tapnova-256.png') -Destination (Join-Path $brandRoot 'tapnova.png')
if ($Preview) {
    $app = [Windows.Application]::new()
    $app.Resources = $theme
    [xml]$xml = [IO.File]::ReadAllText((Join-Path $projectRoot 'MainWindow.xaml'))
    $xml.DocumentElement.RemoveAttribute('Class', 'http://schemas.microsoft.com/winfx/2006/xaml')
    $xml.DocumentElement.RemoveAttribute('Icon')
    foreach ($element in $xml.SelectNodes('//*')) {
        $element.RemoveAttribute('Click')
        $element.RemoveAttribute('KeyDown')
    }
    $browser = $xml.SelectSingleNode('//*[local-name()="WebView2"]')
    $browser.ParentNode.RemoveChild($browser) | Out-Null
    $window = [Windows.Markup.XamlReader]::Parse($xml.OuterXml)
    foreach ($dimensions in @(@(1440, 860), @(1000, 610))) {
        $width = $dimensions[0]; $height = $dimensions[1]
        $root = $window.Content
        $root.Width = $width; $root.Height = $height
        $root.Background = $theme['WindowBg']
        $root.Measure([Windows.Size]::new($width, $height))
        $root.Arrange([Windows.Rect]::new(0, 0, $width, $height))
        $root.UpdateLayout()
        Save-Png $root $width $height (Join-Path $brandRoot "preview-$width.png")
    }
}
Write-Output 'Brand assets rendered successfully.'

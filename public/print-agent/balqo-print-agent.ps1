$Port = 17890
$Prefix = "http://127.0.0.1:$Port/"

function Get-PrinterList {
  $items = @()
  try {
    $items = @(Get-CimInstance -ClassName Win32_Printer | ForEach-Object {
      [pscustomobject]@{
        name = $_.Name
        isDefault = [bool]$_.Default
        port = $_.PortName
      }
    })
  } catch {
    $items = @(Get-Printer | ForEach-Object {
      [pscustomobject]@{
        name = $_.Name
        isDefault = $false
        port = $_.PortName
      }
    })
  }
  return $items
}

function Write-Cors([System.Net.HttpListenerResponse]$Response, [string]$Origin) {
  if ($Origin) {
    $Response.Headers.Add("Access-Control-Allow-Origin", $Origin)
  } else {
    $Response.Headers.Add("Access-Control-Allow-Origin", "*")
  }
  $Response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  $Response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
  $Response.Headers.Add("Access-Control-Allow-Private-Network", "true")
  $Response.Headers.Add("Vary", "Origin")
}

function Send-TextResponse(
  [System.Net.HttpListenerContext]$Context,
  [int]$StatusCode,
  [string]$Body,
  [string]$ContentType = "application/json; charset=utf-8"
) {
  $origin = $Context.Request.Headers["Origin"]
  Write-Cors $Context.Response $origin
  $buffer = [System.Text.Encoding]::UTF8.GetBytes($Body)
  $Context.Response.StatusCode = $StatusCode
  $Context.Response.ContentType = $ContentType
  $Context.Response.ContentEncoding = [System.Text.Encoding]::UTF8
  $Context.Response.ContentLength64 = $buffer.Length
  $Context.Response.OutputStream.Write($buffer, 0, $buffer.Length)
  $Context.Response.OutputStream.Close()
}

function Read-Body([System.Net.HttpListenerRequest]$Request) {
  $reader = New-Object System.IO.StreamReader($Request.InputStream, [System.Text.Encoding]::UTF8)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Close()
  }
}

function Print-Receipt([string]$PrinterName, [string]$Text) {
  $temp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), ("balqo-cupom-{0}.txt" -f [guid]::NewGuid().ToString("N")))
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [System.IO.File]::WriteAllText($temp, $Text, $utf8)
  try {
    Get-Content -LiteralPath $temp -Raw | Out-Printer -Name $PrinterName
    return $true
  } catch {
    $rawTarget = "\\localhost\$PrinterName"
    $copy = Start-Process -FilePath "cmd.exe" -ArgumentList @("/c", "copy /b `"$temp`" `"$rawTarget`"") -Wait -PassThru -WindowStyle Hidden
    if ($copy.ExitCode -eq 0) { return $true }
    throw $_.Exception
  } finally {
    Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
  }
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($Prefix)

try {
  $listener.Start()
} catch {
  Write-Host "Nao foi possivel abrir a porta $Port."
  Write-Host $_.Exception.Message
  Write-Host "Feche outro agente BALQO ou rode de novo como administrador."
  exit 1
}

$printers = Get-PrinterList
Write-Host ""
Write-Host "BALQO Print Agent"
Write-Host "Escutando $Prefix"
Write-Host "Impressoras encontradas: $($printers.Count)"
foreach ($printer in $printers) {
  $mark = ""
  if ($printer.isDefault) { $mark = " (padrao)" }
  Write-Host (" - {0}{1}" -f $printer.name, $mark)
}
Write-Host ""
Write-Host "Deixe esta janela aberta."
Write-Host "No BALQO: Config > Impressora > Atualizar lista e escolha a impressora."
Write-Host "Ctrl+C para sair."
Write-Host ""

while ($listener.IsListening) {
  $context = $null
  try {
    $context = $listener.GetContext()
    $path = $context.Request.Url.AbsolutePath.TrimEnd("/").ToLowerInvariant()
    if (-not $path) { $path = "/" }
    $method = $context.Request.HttpMethod.ToUpperInvariant()

    if ($method -eq "OPTIONS") {
      Send-TextResponse $context 204 ""
      continue
    }

    if ($method -eq "GET" -and ($path -eq "/health" -or $path -eq "/")) {
      Send-TextResponse $context 200 '{"ok":true,"name":"balqo-print-agent"}'
      continue
    }

    if ($method -eq "GET" -and $path -eq "/printers") {
      $list = Get-PrinterList
      $payload = @{ printers = @($list) } | ConvertTo-Json -Compress -Depth 5
      Send-TextResponse $context 200 $payload
      continue
    }

    if ($method -eq "POST" -and $path -eq "/print") {
      $raw = Read-Body $context.Request
      if (-not $raw) {
        Send-TextResponse $context 400 '{"ok":false,"error":"body vazio"}'
        continue
      }
      $data = $raw | ConvertFrom-Json
      $printerName = [string]$data.printerPath
      if (-not $printerName) { $printerName = [string]$data.printerName }
      $text = [string]$data.text
      if (-not $printerName) {
        Send-TextResponse $context 400 '{"ok":false,"error":"impressora nao informada"}'
        continue
      }
      if (-not $text) {
        Send-TextResponse $context 400 '{"ok":false,"error":"cupom vazio"}'
        continue
      }
      Print-Receipt -PrinterName $printerName -Text $text
      Send-TextResponse $context 200 '{"ok":true}'
      continue
    }

    Send-TextResponse $context 404 '{"ok":false,"error":"nao encontrado"}'
  } catch {
    if ($context -ne $null) {
      try {
        $message = $_.Exception.Message.Replace('"', "'")
        Send-TextResponse $context 500 ("{0}`"ok`":false,`"error`":`"{1}`"{2}" -f "{", $message, "}")
      } catch {
        # ignore
      }
    }
    Write-Host ("Erro: {0}" -f $_.Exception.Message)
  }
}

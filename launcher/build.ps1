$compiler = "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
$sourceFile = ".\launcher\Program.cs"
$outputFile = ".\IETM.exe"

if (-not (Test-Path $compiler)) {
    Write-Error "C# compiler not found at $compiler"
    exit 1
}

Write-Host "Compiling Launcher..."
& $compiler /target:winexe /out:$outputFile /optimize+ /reference:System.Net.Http.dll $sourceFile

if ($LASTEXITCODE -eq 0) {
    Write-Host "Launcher compiled successfully to $outputFile"
} else {
    Write-Error "Compilation failed."
    exit $LASTEXITCODE
}

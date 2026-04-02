param([string]$message = "update")
git add .
git commit -m $message
git push
Write-Host "Deploy tamamlandi!" -ForegroundColor Green
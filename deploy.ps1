param([string]$message = "update")
git add .
git commit -m $message
git push
vercel alias zeeky-turkgates-projects.vercel.app zeeky.vercel.app
Write-Host "✅ Deploy tamamlandı!" -ForegroundColor Green
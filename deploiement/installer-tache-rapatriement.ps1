# Cree la tache planifiee quotidienne de rapatriement des sauvegardes (poste de la gerante).
# A lancer UNE SEULE FOIS, depuis PowerShell, apres avoir verifie que la connexion SSH
# fonctionne a la main. Procedure complete : deploiement/README.md.
#
# (Pas d'accents dans ce fichier : PowerShell 5.1 lit les scripts sans BOM en ANSI et
# deformerait les caracteres accentues, y compris dans la description de la tache.)

$ErrorActionPreference = "Stop"

# $PSScriptRoot resout tout seul l'emplacement du depot : aucun chemin a remplacer a la
# main, donc aucun placeholder a se tromper en recopiant.
$action = New-ScheduledTaskAction -Execute "$PSScriptRoot\rapatrier-sauvegardes.cmd"

$declencheur = New-ScheduledTaskTrigger -Daily -At 10:00

# StartWhenAvailable est l'equivalent Windows du « Persistent=true » du timer systemd du
# VPS : si le PC etait eteint a 10h, la tache se rattrape au demarrage suivant.
$reglages = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# La tache tourne sous la session ouverte de la gerante : aucun mot de passe n'est stocke,
# dans la continuite du « aucun mot de passe nulle part » du dispositif de sauvegarde.
Register-ScheduledTask `
    -TaskName "Manne - rapatriement des sauvegardes" `
    -Description "Rapatrie chaque jour les sauvegardes de la base manne_bulles depuis le VPS." `
    -Action $action `
    -Trigger $declencheur `
    -Settings $reglages `
    -Force

Write-Host ""
Write-Host "Tache creee. Verification :"
Get-ScheduledTask -TaskName "Manne - rapatriement des sauvegardes" |
    Get-ScheduledTaskInfo |
    Format-List TaskName, NextRunTime, LastRunTime, LastTaskResult

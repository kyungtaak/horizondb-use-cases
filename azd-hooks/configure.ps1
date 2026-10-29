#requires -Version 7.4

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-z0-9](?:[a-z0-9-]{0,48}[a-z0-9])?$')]
    [string] $EnvironmentName,
    [Parameter(Mandatory)]
    [guid] $SubscriptionId,
    [ValidateSet('create', 'existing')]
    [string] $HorizonDbMode = 'existing',
    [ValidatePattern('^[a-zA-Z0-9_-]{1,80}$')]
    [string] $ResourceGroupName = "rg-horizonship-$EnvironmentName-krc",
    [ValidatePattern('^[a-z][a-z0-9-]{1,14}[a-z0-9]$')]
    [string] $NamePrefix = 'horizonship',
    [ValidatePattern('^[a-zA-Z][a-zA-Z0-9]{0,62}$')]
    [string] $AdministratorLogin = 'horizonadmin',
    [string] $DatabaseName = 'postgres',
    [Parameter(Mandatory)]
    [string] $OpenAiEndpoint,
    [ValidateSet('key', 'entra')]
    [string] $OpenAiAuthentication = 'key',
    [string] $OpenAiAccountName = '',
    [string] $ChatDeployment = 'gpt-5.4',
    [string] $EmbeddingDeployment = 'text-embedding-3-small',
    [string] $ExistingHorizonDbResourceGroup = '',
    [string] $ExistingHorizonDbClusterName = '',
    [switch] $RunDatabaseSetup,
    [switch] $DoNotAllowAzureServices
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Get-Command azd -ErrorAction Stop | Out-Null

if ($OpenAiAuthentication -eq 'entra' -and [string]::IsNullOrWhiteSpace($OpenAiAccountName)) {
    throw 'Entra mode requires -OpenAiAccountName for the AI account in the application resource group.'
}

if (
    $HorizonDbMode -eq 'existing' `
    -and (
        [string]::IsNullOrWhiteSpace($ExistingHorizonDbResourceGroup) `
        -or [string]::IsNullOrWhiteSpace($ExistingHorizonDbClusterName)
    )
) {
    throw 'Existing mode requires -ExistingHorizonDbResourceGroup and -ExistingHorizonDbClusterName.'
}

$environmentExists = Test-Path (Join-Path $PSScriptRoot "../.azure/$EnvironmentName/.env")
if ($environmentExists) {
    & azd env select $EnvironmentName | Out-Null
} else {
    & azd env new $EnvironmentName `
        --subscription $SubscriptionId.ToString() `
        --location koreacentral `
        --no-prompt | Out-Null
}
if ($LASTEXITCODE -ne 0) {
    throw "Could not create or select azd environment $EnvironmentName."
}

$previousMode = (& azd env get-value HORIZONDB_MODE 2>$null | Out-String).Trim()
$previousResourceGroup = (& azd env get-value HORIZONDB_RESOURCE_GROUP 2>$null | Out-String).Trim()
$previousClusterName = (& azd env get-value HORIZONDB_CLUSTER_NAME 2>$null | Out-String).Trim()
$reuseCreatedCluster = (
    $HorizonDbMode -eq 'create' `
    -and $previousMode -eq 'create' `
    -and -not [string]::IsNullOrWhiteSpace($previousResourceGroup) `
    -and -not [string]::IsNullOrWhiteSpace($previousClusterName)
)

$values = [ordered]@{
    AZURE_SUBSCRIPTION_ID = $SubscriptionId.ToString()
    AZURE_LOCATION = 'koreacentral'
    AZURE_RESOURCE_GROUP = $ResourceGroupName
    AZURE_NAME_PREFIX = $NamePrefix
    HORIZONDB_MODE = $HorizonDbMode
    HORIZONDB_CREATE_MODE = $(if ($reuseCreatedCluster) { 'Update' } else { 'Create' })
    HORIZONDB_RESOURCE_GROUP = $(
        if ($HorizonDbMode -eq 'existing') { $ExistingHorizonDbResourceGroup }
        elseif ($reuseCreatedCluster) { $previousResourceGroup }
        else { '' }
    )
    HORIZONDB_CLUSTER_NAME = $(
        if ($HorizonDbMode -eq 'existing') { $ExistingHorizonDbClusterName }
        elseif ($reuseCreatedCluster) { $previousClusterName }
        else { '' }
    )
    AZURE_PG_NAME = $DatabaseName
    AZURE_PG_USER = $AdministratorLogin
    AZURE_OPENAI_ENDPOINT = $OpenAiEndpoint
    AZURE_OPENAI_AUTH_MODE = $OpenAiAuthentication
    AZURE_OPENAI_ACCOUNT_NAME = $OpenAiAccountName
    AZURE_OPENAI_DEPLOYMENT = $ChatDeployment
    AZURE_EMBED_DEPLOYMENT = $EmbeddingDeployment
    CHAT_PROVIDER = 'azure_openai'
    EMBEDDING_PROVIDER = 'azure_openai'
    RUN_DATABASE_SETUP = $RunDatabaseSetup.IsPresent.ToString().ToLowerInvariant()
    ALLOW_AZURE_SERVICES_TO_HORIZONDB = (-not $DoNotAllowAzureServices.IsPresent).ToString().ToLowerInvariant()
    CAPTURE_QUERY_PLAN = 'true'
}

foreach ($entry in $values.GetEnumerator()) {
    & azd env set $entry.Key ([string] $entry.Value) | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw "Could not set azd environment value $($entry.Key)."
    }
}

$databasePassword = Read-Host 'HorizonDB administrator password' -AsSecureString
$openAiKey = if ($OpenAiAuthentication -eq 'key') {
    Read-Host 'Azure OpenAI subscription key' -AsSecureString
} else { $null }
$databasePasswordPointer = [IntPtr]::Zero
$openAiKeyPointer = [IntPtr]::Zero
try {
    $databasePasswordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($databasePassword)
    $databasePasswordText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($databasePasswordPointer)

    & azd env set AZURE_PG_PASSWORD $databasePasswordText | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Could not store AZURE_PG_PASSWORD.' }
    if ($null -ne $openAiKey) {
        $openAiKeyPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($openAiKey)
        $openAiKeyText = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($openAiKeyPointer)
        & azd env set AZURE_OPENAI_KEY $openAiKeyText | Out-Null
        if ($LASTEXITCODE -ne 0) { throw 'Could not store AZURE_OPENAI_KEY.' }
    }
} finally {
    if ($databasePasswordPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($databasePasswordPointer)
    }
    if ($openAiKeyPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($openAiKeyPointer)
    }
    $databasePassword.Dispose()
    if ($null -ne $openAiKey) { $openAiKey.Dispose() }
    Remove-Variable databasePasswordText, openAiKeyText -ErrorAction SilentlyContinue
}

Write-Host "Configured azd environment '$EnvironmentName' in $HorizonDbMode mode."
Write-Warning 'azd stores these environment values locally under .azure. Keep that directory private and remove the environment after the demo.'
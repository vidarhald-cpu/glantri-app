// Azure Blob storage for Glantri Artifacts and Map backgrounds (#1053).
//
// The API reaches this account only through its system-assigned managed
// identity (DefaultAzureCredential in apps/api/src/artifacts/azureArtifactBinaryStore.ts).
// No account key, SAS or connection string is used anywhere, so shared-key
// access is disabled. Browsing the container in the portal or with the az CLI
// therefore needs Entra ID authentication (`--auth-mode login`).
//
// The role assignment for the API identity lives in storageAccess.bicep, so
// that this module does not depend on the App Service module (which consumes
// this module's outputs for its app settings).

@description('Storage account name: 3-24 lowercase letters and digits, globally unique.')
@minLength(3)
@maxLength(24)
param name string

param location string

@description('Private blob container that holds Artifact and Map binaries.')
@minLength(3)
@maxLength(63)
param containerName string

@description('Days a deleted blob or container stays recoverable.')
@minValue(1)
@maxValue(365)
param softDeleteRetentionDays int = 7

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: name
  location: location
  kind: 'StorageV2'
  sku: { name: 'Standard_LRS' }
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false
    defaultToOAuthAuthentication: true
    allowCrossTenantReplication: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    // The App Service plan has no VNet integration, so the API reaches the
    // account over its public endpoint. Anonymous access is still impossible:
    // public blob access and shared keys are both disabled.
    publicNetworkAccess: 'Enabled'
  }
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: account
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
    containerDeleteRetentionPolicy: {
      enabled: true
      days: softDeleteRetentionDays
    }
  }
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

// primaryEndpoints.blob is 'https://<account>.blob.<suffix>/' with a trailing
// slash; the API setting uses the bare account URL.
var blobEndpoint = account.properties.primaryEndpoints.blob

output accountName string = account.name
output accountId string = account.id
output blobEndpoint string = blobEndpoint
output accountUrl string = endsWith(blobEndpoint, '/') ? substring(blobEndpoint, 0, length(blobEndpoint) - 1) : blobEndpoint
output containerName string = container.name

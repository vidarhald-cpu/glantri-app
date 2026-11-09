// RBAC: the API app's system-assigned identity may read, write and delete
// blobs in the Artifact container only (#1053). Follows the kvAccess.bicep
// pattern. The Web app gets no storage access: Artifact and Map binaries are
// served through the API.

param storageAccountName string
param containerName string
param apiPrincipalId string

// Built-in role: Storage Blob Data Contributor
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'

resource account 'Microsoft.Storage/storageAccounts@2023-05-01' existing = {
  name: storageAccountName
}

resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' existing = {
  parent: account
  name: 'default'
}

resource container 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' existing = {
  parent: blobService
  name: containerName
}

resource apiBlobAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(container.id, apiPrincipalId, storageBlobDataContributorRoleId)
  scope: container
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output roleAssignmentId string = apiBlobAccess.id
output scope string = container.id

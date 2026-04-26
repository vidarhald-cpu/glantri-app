param kvName string
param apiPrincipalId string
param webPrincipalId string

var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: kvName
}

resource apiAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, apiPrincipalId, kvSecretsUserRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: apiPrincipalId
    principalType: 'ServicePrincipal'
  }
}

resource webAccess 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(kv.id, webPrincipalId, kvSecretsUserRoleId)
  scope: kv
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
    principalId: webPrincipalId
    principalType: 'ServicePrincipal'
  }
}

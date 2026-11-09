param prefix string
param location string
param keyVaultUri string
param registryServer string

@description('Blob account URL for Artifact storage, e.g. https://<account>.blob.core.windows.net')
param artifactAzureAccountUrl string

@description('Private blob container for Artifact storage')
param artifactAzureContainer string

resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${prefix}-plan'
  location: location
  kind: 'linux'
  sku: { name: 'B1', tier: 'Basic' }
  properties: { reserved: true }
}

resource apiApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-api'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${registryServer}/glantri-api:latest'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'DATABASE_URL'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/database-url/)'
        }
        {
          name: 'WEB_ORIGIN'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/web-origin/)'
        }
        {
          name: 'WEBSITES_PORT'
          value: '4000'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/appinsights-connection-string/)'
        }
        // Artifact and Map storage (#1053), read by
        // apps/api/src/artifacts/artifactStorageConfig.ts. Managed identity
        // only: no key or connection string.
        {
          name: 'ARTIFACT_STORAGE_PROVIDER'
          value: 'azure'
        }
        {
          name: 'ARTIFACT_AZURE_ACCOUNT_URL'
          value: artifactAzureAccountUrl
        }
        {
          name: 'ARTIFACT_AZURE_CONTAINER'
          value: artifactAzureContainer
        }
      ]
      appCommandLine: ''
    }
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: '${prefix}-web'
  location: location
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'DOCKER|${registryServer}/glantri-web:latest'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'WEBSITES_PORT'
          value: '3000'
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/appinsights-connection-string/)'
        }
      ]
      appCommandLine: ''
    }
  }
}

output apiUrl string = 'https://${apiApp.properties.defaultHostName}'
output webUrl string = 'https://${webApp.properties.defaultHostName}'
output apiPrincipalId string = apiApp.identity.principalId
output webPrincipalId string = webApp.identity.principalId
output apiAppName string = apiApp.name
output webAppName string = webApp.name

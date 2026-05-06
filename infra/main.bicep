targetScope = 'resourceGroup'

@description('Miljønavn')
@allowed(['dev', 'prod'])
param environment string

@description('Azure-region')
param location string = resourceGroup().location

@description('PostgreSQL admin-passord')
@secure()
param dbAdminPassword string

@description('URL til frontend (brukes av API for CORS)')
param webOrigin string

@description('E-postadresse for varsler')
param alertEmail string

var prefix = 'glantri-${environment}'
var kvName = 'glantri-${environment}-kv'
var dbAdminUser = 'glantri_admin'

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    name: '${prefix}-insights'
    location: location
    alertEmail: alertEmail
  }
}

module keyVault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: kvName
    location: location
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    name: '${prefix}-postgres'
    location: location
    adminUser: dbAdminUser
    adminPassword: dbAdminPassword
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    name: 'glantri${environment}acr'
    location: location
  }
}

module appService 'modules/appservice.bicep' = {
  name: 'appservice'
  params: {
    prefix: prefix
    location: location
    keyVaultUri: keyVault.outputs.uri
  }
}

// Hemmeligheter i Key Vault — bruker modul slik at keyVault.outputs.name
// skaper en implisitt avhengighet og Bicep vet rekkefølgen
module kvSecrets 'modules/kvSecrets.bicep' = {
  name: 'kvSecrets'
  params: {
    kvName: keyVault.outputs.name
    databaseUrl: 'postgresql://${dbAdminUser}:${dbAdminPassword}@${postgres.outputs.fqdn}:5432/glantri?sslmode=require'
    webOrigin: webOrigin
    appInsightsConnectionString: monitoring.outputs.connectionString
  }
}

// RBAC: App Services lesetilgang til Key Vault
module kvAccess 'modules/kvAccess.bicep' = {
  name: 'kvAccess'
  params: {
    kvName: keyVault.outputs.name
    apiPrincipalId: appService.outputs.apiPrincipalId
    webPrincipalId: appService.outputs.webPrincipalId
  }
}

output apiUrl string = appService.outputs.apiUrl
output webUrl string = appService.outputs.webUrl
output apiAppName string = appService.outputs.apiAppName
output webAppName string = appService.outputs.webAppName
output acrLoginServer string = acr.outputs.loginServer
output acrName string = acr.outputs.name

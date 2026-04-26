using './main.bicep'

param environment = 'dev'
param webOrigin = 'https://glantri-dev-web.azurewebsites.net'
param alertEmail = 'joakim.kosmo@gmail.com'
param dbAdminPassword = readEnvironmentVariable('GLANTRI_DB_PASSWORD', '')

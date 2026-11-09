# Azure Blob storage for Artifacts and Maps — maintainer runbook

This runbook provisions the storage that Artifacts and Map backgrounds need on
Azure (#1053). It follows the Product Owner's seven-step storage checklist on
#1053 (comment 24273). It is written for the maintainer who holds the Azure
rights. Nothing here has been compiled, validated or applied by the
development lane: `az` and `bicep` were not available there. **Compile and
`what-if` first, every time.**

## What the code needs

`apps/api/src/artifacts/artifactStorageConfig.ts` enables Azure storage only
when all three API app settings are present:

| Setting                      | Value                                                    |
| ---------------------------- | -------------------------------------------------------- |
| `ARTIFACT_STORAGE_PROVIDER`  | `azure`                                                  |
| `ARTIFACT_AZURE_ACCOUNT_URL` | `https://<account>.blob.core.windows.net` (no container) |
| `ARTIFACT_AZURE_CONTAINER`   | the container name, by default `glantri-artifacts`       |

Otherwise storage is disabled and the UI shows "Artifact storage is
temporarily unavailable." The `local` provider is refused when
`NODE_ENV=production`. **Do not improvise a local-disk fallback in production.**
If Azure storage cannot be proven end to end, report Maps as unavailable for
the release.

`apps/api/src/artifacts/azureArtifactBinaryStore.ts` authenticates with
`DefaultAzureCredential`. On App Service this resolves to the API app's
system-assigned managed identity. No account key, SAS or connection string is
used, so the account is created with shared-key access disabled.

Two consequences:

- Do **not** set `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` or
  `AZURE_USERNAME` on the API app. `DefaultAzureCredential` would try those
  before the system-assigned identity.
- To browse the container yourself, use Entra ID (`--auth-mode login` in the
  CLI, "Microsoft Entra user account" in the portal) and give yourself a blob
  data role. Account keys will not work.

## What the infrastructure code contains

| File                                | Contents                                                                                                                                                                                                                                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `infra/modules/storage.bicep`       | StorageV2 `Standard_LRS` account: no public blob access, no shared keys, OAuth by default, TLS 1.2, HTTPS only, no cross-tenant replication. Blob service with 7-day blob and container soft delete. A container with public access `None`. Outputs: account name and id, blob endpoint, account URL, container name. |
| `infra/modules/storageAccess.bicep` | `Storage Blob Data Contributor` (`ba92f5b4-2d11-453d-a403-e96b0029c9fe`) for the API app's identity, scoped to **the container**, with a deterministic `guid(container.id, apiPrincipalId, roleId)` name. The Web app gets no storage role.                                                                           |
| `infra/modules/appservice.bicep`    | The three `ARTIFACT_*` settings on the **API** app, passed in as parameters.                                                                                                                                                                                                                                          |
| `infra/main.bicep`                  | Wires the modules. New parameters `artifactStorageAccountName` (default `glantri<environment>artifacts`, e.g. `glantridevartifacts`) and `artifactContainerName` (default `glantri-artifacts`). New outputs for the account name, account URL and container name.                                                     |

`infra/dev.bicepparam` is unchanged: both new parameters have defaults. No
secret or key appears in any of these files or their parameters.

## Before you start

### 1. Rights

You need, on the target resource group:

- **Contributor** (or Storage Account Contributor) to create the storage
  account, blob service and container, and to change App Service settings;
- **Owner**, **User Access Administrator** or **Role Based Access Control
  Administrator** to create the role assignment
  (`Microsoft.Authorization/roleAssignments/write`).

The `Microsoft.Storage` resource provider must be registered on the
subscription:

```bash
az provider show --namespace Microsoft.Storage --query registrationState -o tsv
# expect: Registered
```

### 2. Identify the real target

The Bicep names are `glantri-<environment>-api`, `glantri-<environment>-web`
and so on, while `deploy.yml` hard-codes the resource group `rg_glantri` and
reads the app names from secrets. Confirm what actually exists before choosing
a path:

```bash
RG=rg_glantri                 # the resource group that holds the API app
API_APP=<the API app name>    # e.g. glantri-dev-api
ACCOUNT=glantridevartifacts   # or your chosen name
CONTAINER=glantri-artifacts

az webapp show -g "$RG" -n "$API_APP" --query "{name:name, location:location}" -o table
az storage account check-name --name "$ACCOUNT" -o table
```

`check-name` must report the name as available (or as already yours in this
resource group). Storage account names are global. If the name is taken,
choose another 3–24 character lowercase name and pass it as
`artifactStorageAccountName` (path A) or `name` (path B).

Use a **dedicated** account. Do not point these templates at an existing
account that serves anything else: the deployment would disable its shared
keys and public access.

### 3. Confirm the API has a system-assigned identity

```bash
az webapp identity show -g "$RG" -n "$API_APP" --query "{type:type, principalId:principalId}" -o table
```

`type` must include `SystemAssigned` and `principalId` must be set. The Key
Vault references already depend on this identity.

### 4. Back up and record

Follow the release runbook on #1053 (comment 23999): record the PITR point or
take an on-demand backup, and record the current API and Web image tags.

## Choose a path

### Why the full `main.bicep` apply needs care

A Bicep `siteConfig.appSettings` array **replaces the app's whole settings
set**; it does not merge. `az webapp config appsettings set`, which
`deploy.yml` uses, **does** merge. So:

- **`deploy.yml` will not wipe the `ARTIFACT_*` settings.** It only sets
  `WEBSITES_PORT` (4000 for the API, 3000 for the Web app) and an empty
  startup command, and both match what `appservice.bicep` declares.
- **A full `main.bicep` apply removes every API or Web setting that is not in
  `appservice.bicep`.** Anything added in the portal or by CLI disappears,
  including any `DOCKER_REGISTRY_SERVER_*` registry credentials (the Bicep does
  not configure how the apps pull from ACR).
- A full apply also resets each app's image to `<registry>/glantri-*:latest`,
  overriding the `:<sha>` tag that `azure/webapps-deploy` set. `deploy.yml`
  pushes `:latest` alongside `:<sha>`, so this is normally the same image, but
  after an image rollback it rolls forward again.
- A full apply also rewrites the Key Vault secrets (including `database-url`
  built from `dbAdminPassword`) and the PostgreSQL admin password. A wrong
  `GLANTRI_DB_PASSWORD` breaks the database connection.

List the existing setting **names** (not values) and compare them with the
Bicep list:

```bash
az webapp config appsettings list -g "$RG" -n "$API_APP" --query "[].name" -o tsv | sort
```

After this change the API list in `appservice.bicep` is exactly: `NODE_ENV`,
`DATABASE_URL`, `WEB_ORIGIN`, `WEBSITES_PORT`,
`APPLICATIONINSIGHTS_CONNECTION_STRING`, `ARTIFACT_STORAGE_PROVIDER`,
`ARTIFACT_AZURE_ACCOUNT_URL`, `ARTIFACT_AZURE_CONTAINER`. Do the same for the
Web app (`NODE_ENV`, `WEBSITES_PORT`, `APPLICATIONINSIGHTS_CONNECTION_STRING`).

- If Azure was built from this Bicep, the names match, and you accept the
  points above: **path A**.
- Otherwise, or if in doubt: **path B**. It touches only the storage account,
  the role assignment and three API settings. The configuration is still
  recorded in `main.bicep`; reconcile the rest of the environment with the
  Bicep separately.

### Path A — full `main.bicep`

```bash
export GLANTRI_DB_PASSWORD=<the existing PostgreSQL admin password>   # never commit it

az bicep build --file infra/main.bicep --stdout > /dev/null

az deployment group what-if -g "$RG" \
  --template-file infra/main.bicep --parameters infra/dev.bicepparam
```

Read the `what-if` output in full. The expected changes for this work are:

- **Create** `Microsoft.Storage/storageAccounts` `$ACCOUNT`, its
  `blobServices/default` and `containers/glantri-artifacts`;
- **Create** one `Microsoft.Authorization/roleAssignments` on that container;
- **Modify** the API site's settings to add the three `ARTIFACT_*` settings.

Stop if anything else would be created, deleted or changed in a way you did
not expect. Then apply:

```bash
az deployment group create -g "$RG" \
  --template-file infra/main.bicep --parameters infra/dev.bicepparam \
  --query properties.outputs -o json
```

The outputs include `artifactStorageAccountUrl` and `artifactContainerName`.

### Path B — storage only (recommended for Alpha draft 1)

1. The account and container:

   ```bash
   az bicep build --file infra/modules/storage.bicep --stdout > /dev/null

   az deployment group what-if -g "$RG" --template-file infra/modules/storage.bicep \
     --parameters name="$ACCOUNT" location=<the API app's location> containerName="$CONTAINER"

   az deployment group create -g "$RG" --template-file infra/modules/storage.bicep \
     --parameters name="$ACCOUNT" location=<the API app's location> containerName="$CONTAINER" \
     --query properties.outputs -o json
   ```

   `what-if` should show only the account, the blob service and the container
   being created. Note the `accountUrl` output.

2. The role assignment on the container:

   ```bash
   API_PRINCIPAL_ID=$(az webapp identity show -g "$RG" -n "$API_APP" --query principalId -o tsv)

   az deployment group what-if -g "$RG" --template-file infra/modules/storageAccess.bicep \
     --parameters storageAccountName="$ACCOUNT" containerName="$CONTAINER" apiPrincipalId="$API_PRINCIPAL_ID"

   az deployment group create -g "$RG" --template-file infra/modules/storageAccess.bicep \
     --parameters storageAccountName="$ACCOUNT" containerName="$CONTAINER" apiPrincipalId="$API_PRINCIPAL_ID"
   ```

3. The three API settings (merging, so no other setting is touched). This
   restarts the API:

   ```bash
   az webapp config appsettings set -g "$RG" -n "$API_APP" --output none --settings \
     ARTIFACT_STORAGE_PROVIDER=azure \
     ARTIFACT_AZURE_ACCOUNT_URL="https://$ACCOUNT.blob.core.windows.net" \
     ARTIFACT_AZURE_CONTAINER="$CONTAINER"
   ```

   `--output none` stops the command echoing every setting value.

## Verify

Run these after either path. None of them reveals a secret.

```bash
# Account posture: expect false, false, TLS1_2, true
az storage account show -g "$RG" -n "$ACCOUNT" \
  --query "{publicBlob:allowBlobPublicAccess, sharedKey:allowSharedKeyAccess, tls:minimumTlsVersion, httpsOnly:enableHttpsTrafficOnly}" -o table

# Container is private: expect None
az storage container-rm show -g "$RG" --storage-account "$ACCOUNT" -n "$CONTAINER" \
  --query properties.publicAccess -o tsv

# The role assignment exists on the container, for the API identity
CONTAINER_ID="$(az storage account show -g "$RG" -n "$ACCOUNT" --query id -o tsv)/blobServices/default/containers/$CONTAINER"
az role assignment list --scope "$CONTAINER_ID" \
  --query "[].{role:roleDefinitionName, principalId:principalId, scope:scope}" -o table
# expect: Storage Blob Data Contributor, principalId = $API_PRINCIPAL_ID, scope = $CONTAINER_ID

# The settings exist (these values are not secrets)
az webapp config appsettings list -g "$RG" -n "$API_APP" \
  --query "[?starts_with(name, 'ARTIFACT_')].{name:name, value:value}" -o table

# Anonymous access is refused: expect a 4xx (typically 409 PublicAccessNotPermitted), never 200
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://$ACCOUNT.blob.core.windows.net/$CONTAINER?restype=container&comp=list"
```

A new role assignment can take several minutes to take effect. If the first
upload fails with 403 `AuthorizationPermissionMismatch` in the API log, wait
ten minutes, restart the API (`az webapp restart -g "$RG" -n "$API_APP"`) and
retry. A persistent 403 means the role is on the wrong scope or the wrong
principal.

## End-to-end Map smoke test (checklist step 7)

Run this in the deployed Web app as a GM and as a player, in Safari and
Chrome. Use a small prepared map image.

1. The GM uploads one prepared map. The upload completes, with no "Artifact
   storage is temporarily unavailable" message.
2. The map background renders.
3. The GM places a pin and makes it player-visible.
4. The player sees the map and that pin.
5. The GM makes a second pin GM-only. The player does not see it.
6. Restart the API (`az webapp restart`) and reopen the map, as both GM and
   player. The map and both pins persist, with the same visibility.

Also check the API log stream for `artifact_operation_failed` during the test,
and confirm that one blob appeared (with your own blob data role and
`--auth-mode login`, or in the portal's container view).

Record the result on #1053: pass, or a clear statement that Maps are
unavailable for this release.

## Rollback

- **Disable storage, keep the data:** delete the three settings. The API
  returns to "Artifact storage is temporarily unavailable"; uploaded blobs stay
  in the container.

  ```bash
  az webapp config appsettings delete -g "$RG" -n "$API_APP" --setting-names \
    ARTIFACT_STORAGE_PROVIDER ARTIFACT_AZURE_ACCOUNT_URL ARTIFACT_AZURE_CONTAINER
  ```

  On path A, also remove the three entries from `appservice.bicep` before the
  next full apply, or that apply will add them back.

- **Revoke access:** delete the role assignment
  (`az role assignment delete --ids <id from the list above>`).
- **Remove the storage:** `az storage account delete -g "$RG" -n "$ACCOUNT"`.
  This **permanently destroys every uploaded Artifact and Map**; soft delete
  does not protect against deleting the account. Do it only when nothing in it
  is worth keeping.
- **Database rollback interaction:** a database restore to before an upload
  leaves that upload's blob orphaned in the container. This is harmless. A
  deleted blob is recoverable for 7 days through blob soft delete.
- Never switch to `ARTIFACT_STORAGE_PROVIDER=local` in production; the API
  refuses it.

## Not covered here

- Private endpoints or VNet integration. The B1 plan has neither, so the
  account keeps its public endpoint, with anonymous and shared-key access
  disabled.
- A staging environment. `main.bicep` allows only `dev` and `prod` for
  `environment`; a `staging` deployment needs that list changed first.
- A delete lock on the storage account. Consider one once the storage holds
  real campaign data.

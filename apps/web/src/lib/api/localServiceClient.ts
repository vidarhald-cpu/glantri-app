export { API_BASE_URL } from "./apiConfig";
export { ApiRequestError, type ApiErrorPayload, parseResponse, sendJson } from "./apiClient";
export {
  bootstrapGameMasterRole,
  getBootstrapGameMasterAvailability,
  getCurrentSessionUser,
  loadAuthUsers,
  loginLocalUser,
  logoutLocalUser,
  registerLocalUser,
  updateAuthUserRole
} from "./authClient";
export {
  activateChargenRuleSet,
  createChargenRuleSet,
  loadActiveChargenRuleSet,
  loadChargenRuleSets,
  type ChargenRuleSetStoreResponse
} from "./chargenClient";
export {
  loadMyServerCharacters,
  loadServerCharacterById,
  loadServerCharacters,
  saveCharacterToServer,
  updateServerCharacter,
  type ServerCharacterRecord
} from "./characterClient";
export {
  addCampaignRosterEntryOnServer,
  createCampaignAssetOnServer,
  createCampaignOnServer,
  createReusableEntityOnServer,
  createScenarioOnServer,
  createTemplateOnServer,
  loadAccessibleCampaignById,
  loadAccessibleCampaigns,
  loadCampaignAssets,
  loadCampaignById,
  loadCampaignEntities,
  loadCampaignRoster,
  loadCampaignScenarioRelationships,
  loadCampaignScenarios,
  loadCampaigns,
  loadTemplates,
  removeCampaignRosterEntryOnServer,
  updateTemplateOnServer,
  type AccessibleCampaignRecord
} from "./campaignClient";
export {
  addScenarioParticipantFromCharacterOnServer,
  addScenarioParticipantFromEntityOnServer,
  loadJoinableScenarios,
  loadScenarioById,
  loadScenarioEventLogs,
  loadScenarioParticipants,
  loadScenarioPlayerProjection,
  updateCampaignAssetVisibilityOnServer,
  updateScenarioLiveStateOnServer,
  updateScenarioOnServer,
  updateScenarioParticipantMetadataOnServer,
  updateScenarioParticipantStateOnServer,
  type JoinableScenarioRecord,
  type ScenarioParticipantFromCharacterInput,
  type ScenarioParticipantFromEntityInput
} from "./scenarioClient";
export {
  createEncounterOnServer,
  loadEncounterById,
  loadScenarioEncounters,
  updateEncounterOnServer
} from "./encounterClient";
export {
  addCharacterEquipmentItemOnServer,
  bootstrapSampleCharacterEquipmentOnServer,
  createCharacterStorageLocationOnServer,
  loadCharacterEquipmentState,
  moveCharacterEquipmentItemOnServer,
  removeCharacterEquipmentItemOnServer,
  removeCharacterStorageLocationOnServer,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer,
  updateCharacterEquipmentMetadataOnServer,
  updateCharacterEquipmentQuantityOnServer,
  type EquipmentStateResponse
} from "./equipmentClient";
export {
  isAdminContentConflictPayload,
  loadAdminCanonicalContentFromServer,
  saveAdminCanonicalContentToServer
} from "./adminContentClient";

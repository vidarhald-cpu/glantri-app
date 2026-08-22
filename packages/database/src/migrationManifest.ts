// Generated from prisma/migrations/*/migration.sql. Keep this manifest in the
// application artifact so compatibility checks do not depend on source files
// being present in the runtime image.
export const knownDatabaseMigrations = [
  {
    name: "20260311130152_init",
    checksum: "129ee8b0fc9f46f3bddcb478b2eaa91aea44bf8b5deee242ff9936a435ff8f93",
  },
  {
    name: "20260326152000_add_canonical_content_snapshot",
    checksum: "950a43d89a1c518a4dff7aa7339283e45903988a94ad2e2e0091da5763c6b3d8",
  },
  {
    name: "20260331065306_init",
    checksum: "92e2b9b5487eb3464f9b9550d8049683987df819beee071c02ff4fec49772d3f",
  },
  {
    name: "20260407140000_add_equipment_persistence_v1",
    checksum: "57cc8040e4fd8dbea457a71bfe25f1624ccbb3486afa1061db59a4126e392fba",
  },
  {
    name: "20260408123000_add_location_availability_class",
    checksum: "0c559b00c9878fc6d8df8ede06c3d5b7e18344470108d915469385f3d906ff7e",
  },
  {
    name: "20260414110000_add_campaign_scenario_scaffolding",
    checksum: "d94ff1934af0b12bd83428c16cba70e8140dcae00bd8c3373abc0f72aeaf30e5",
  },
  {
    name: "20260421154011_add_scenario_participant_control_metadata",
    checksum: "530a51be8c449a549d882580023b18161af42e40cad03b8a14270b3fe704a388",
  },
  {
    name: "20260422101500_add_equipment_previous_storage_assignment",
    checksum: "40cbec1bbe298e51e426610517090c8ada87e18c5a05751db51a24aa193f2cd5",
  },
  {
    name: "20260425153000_add_server_backed_encounter_sessions",
    checksum: "af981310079b37aa9ae7863386ffe86b00231f3d7140f5c6f5b7774c8531359c",
  },
  {
    name: "20260503200510_add_the_new_campaign_roster_entry_table",
    checksum: "4e6ae2be76d16ec2199dc006d7b1cf4a7f82fde9e0550d51292eacfca0ed1969",
  },
  {
    name: "20260503211500_add_campaign_roster_entries",
    checksum: "0157fd88e30f1d71a221bba181ab546ffbc61505c156d8aec73f00113ec371c0",
  },
  {
    name: "20260504103000_add_scenario_relationships",
    checksum: "dab4b445b559f49e580406c9a6c6a38a0ea11df620e889295acb964312055e6d",
  },
  {
    name: "20260726183000_split_combat_state_storage",
    checksum: "4e4be099215d8855cd87d2669fc937a3c78dbd04bc2b02f26697265a0edba4bf",
  },
  {
    name: "20260811210000_item_authority_foundation_b1",
    checksum: "6d2022ea92e4bbc58a244e15e71611df6e86d93e7ff20d8d4e35ed7cdf08661e",
  },
] as const;

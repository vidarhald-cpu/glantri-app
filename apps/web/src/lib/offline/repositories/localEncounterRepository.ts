import { encounterSessionSchema, type EncounterSession } from "@glantri/domain";

import { localDb } from "../glantriDexie";

export class LocalEncounterRepository {
  async get(id: string): Promise<EncounterSession | undefined> {
    const record = await localDb.encounters.get(id);
    return record ? encounterSessionSchema.parse(record) : undefined;
  }

  async list(): Promise<EncounterSession[]> {
    const records = await localDb.encounters.orderBy("updatedAt").reverse().toArray();
    return records.map((record) => encounterSessionSchema.parse(record));
  }

  async save(session: EncounterSession): Promise<EncounterSession> {
    const normalized = encounterSessionSchema.parse(session);
    await localDb.encounters.put(normalized);
    return normalized;
  }

  async delete(id: string): Promise<void> {
    await localDb.encounters.delete(id);
  }
}

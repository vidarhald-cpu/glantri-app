"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  CampaignMapAccess,
  CampaignMapAuthoringOptions,
  CampaignMapGmDto,
  CampaignMapGmMarker,
  CampaignMapLayerVisibility,
  CampaignMapMarkerKind,
  CampaignMapMarkerVisibility,
  CampaignMapPlayerDto,
  CampaignMapPlayerMarker,
  CampaignMapRole,
  CampaignMapSummary,
} from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";
import {
  campaignMapBackgroundUrl,
  createCampaignMap,
  loadCampaignMap,
  loadCampaignMapAuthoringOptions,
  loadCampaignMaps,
  saveCampaignMap,
} from "@/lib/api/mapClient";

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  minWidth: 0,
  padding: "1rem",
} as const;

const fieldStyle = { display: "grid", gap: "0.25rem", minWidth: 0 } as const;

function roleLabel(role: CampaignMapRole): string {
  if (role === "world_region") return "World or region";
  if (role === "tactical") return "Tactical reference";
  return "Area";
}

function markerSymbol(marker: { kind: CampaignMapMarkerKind; presentation: string }): string {
  if (marker.presentation.trim() && marker.presentation !== "pin") return marker.presentation;
  if (marker.kind === "map_link") return "↗";
  if (marker.kind === "entity_reference") return "◆";
  return "●";
}

function canvasMarkerStyle(marker: { x: number; y: number }) {
  return {
    left: `${marker.x * 100}%`,
    position: "absolute" as const,
    top: `${marker.y * 100}%`,
    transform: "translate(-50%, -50%)",
    zIndex: 2,
  };
}

function cloneGmMap(map: CampaignMapGmDto): CampaignMapGmDto {
  return structuredClone(map);
}

function makeId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

interface MapCanvasProps {
  campaignId: string;
  isGameMaster: boolean;
  map: CampaignMapGmDto | CampaignMapPlayerDto;
  onNavigate: (mapId: string) => void;
  onReposition?: (x: number, y: number) => void;
  onSelectMarker?: (markerId: string) => void;
  selectedMarkerId?: string;
}

function MapCanvas({
  campaignId,
  isGameMaster,
  map,
  onNavigate,
  onReposition,
  onSelectMarker,
  selectedMarkerId,
}: MapCanvasProps) {
  const gmMap = "version" in map ? map : undefined;
  const markers: Array<CampaignMapGmMarker | CampaignMapPlayerMarker> =
    "version" in map
      ? map.layers.flatMap((layer) => layer.markers)
      : [...map.layers.flatMap((layer) => layer.markers), ...map.revealedMarkers];
  const hasBackground = gmMap ? gmMap.background?.available : Boolean(map.background?.available);
  const altText = gmMap?.background?.altText ?? map.background?.altText ?? `${map.name} background`;

  return (
    <section style={{ ...panelStyle, padding: "0.75rem" }} aria-label={`${map.name} Map canvas`}>
      <div
        onClick={(event) => {
          if (!isGameMaster || !onReposition || !selectedMarkerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          onReposition(
            Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
            Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
          );
        }}
        style={{
          aspectRatio: "16 / 9",
          background: hasBackground ? "#dfe5e1" : "#eef1ed",
          border: "1px solid #9da8a2",
          borderRadius: 10,
          minHeight: 240,
          overflow: "hidden",
          position: "relative",
          width: "100%",
        }}
      >
        {hasBackground ? (
          <img
            alt={altText}
            src={campaignMapBackgroundUrl(campaignId, map.id)}
            style={{
              height: "100%",
              inset: 0,
              objectFit: "fill",
              position: "absolute",
              width: "100%",
            }}
          />
        ) : (
          <div
            style={{
              alignItems: "center",
              color: "#4c5952",
              display: "flex",
              height: "100%",
              justifyContent: "center",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            This Map uses an open spatial canvas without a background.
          </div>
        )}
        {markers.map((marker) => {
          const isLink = marker.kind === "map_link" && Boolean(marker.destinationMapId);
          return (
            <button
              aria-label={`${marker.label}${isLink ? ", open linked Map" : ""}`}
              key={marker.id}
              onClick={(event) => {
                event.stopPropagation();
                if (isGameMaster) onSelectMarker?.(marker.id);
                else if (isLink && marker.destinationMapId) onNavigate(marker.destinationMapId);
              }}
              onDoubleClick={() => {
                if (isLink && marker.destinationMapId) onNavigate(marker.destinationMapId);
              }}
              style={{
                ...canvasMarkerStyle(marker),
                background: marker.id === selectedMarkerId ? "#f6d776" : "white",
                border: "2px solid #2f5d62",
                borderRadius: 999,
                cursor: "pointer",
                fontWeight: 800,
                minHeight: 34,
                minWidth: 34,
              }}
              title={`${marker.label}${marker.description ? ` — ${marker.description}` : ""}`}
              type="button"
            >
              {markerSymbol(marker)}
            </button>
          );
        })}
      </div>
      {isGameMaster && selectedMarkerId ? (
        <small>Click anywhere on the canvas to move the selected marker.</small>
      ) : null}
    </section>
  );
}

export function MapWorkspace({
  campaignId,
  initialMapId,
  isGameMaster,
  onMapRouteChange,
}: {
  campaignId: string;
  initialMapId?: string;
  isGameMaster: boolean;
  onMapRouteChange: (mapId?: string) => void;
}) {
  const [maps, setMaps] = useState<CampaignMapSummary[]>([]);
  const [selectedMapId, setSelectedMapId] = useState<string | undefined>(initialMapId);
  const [loadedMap, setLoadedMap] = useState<CampaignMapGmDto | CampaignMapPlayerDto>();
  const [draft, setDraft] = useState<CampaignMapGmDto>();
  const [options, setOptions] = useState<CampaignMapAuthoringOptions>();
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>();
  const [newMapName, setNewMapName] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const refreshList = useCallback(async () => {
    const result = await loadCampaignMaps(campaignId);
    setMaps(result.maps);
    return result.maps;
  }, [campaignId]);

  const openMap = useCallback(
    async (mapId: string) => {
      setLoading(true);
      setError(undefined);
      try {
        const result = await loadCampaignMap(campaignId, mapId);
        setLoadedMap(result.map);
        setDraft(result.mode === "gm" ? cloneGmMap(result.map) : undefined);
        setSelectedMapId(mapId);
        setSelectedMarkerId(undefined);
        onMapRouteChange(mapId);
      } catch (caught) {
        setLoadedMap(undefined);
        setDraft(undefined);
        setError(caught instanceof Error ? caught.message : "This Map is unavailable.");
      } finally {
        setLoading(false);
      }
    },
    [campaignId, onMapRouteChange],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      refreshList(),
      isGameMaster ? loadCampaignMapAuthoringOptions(campaignId) : Promise.resolve(undefined),
    ])
      .then(async ([nextMaps, nextOptions]) => {
        if (!active) return;
        setOptions(nextOptions);
        const requested = nextMaps.find((map) => map.id === initialMapId)?.id ?? nextMaps[0]?.id;
        if (requested) await openMap(requested);
        else {
          setLoadedMap(undefined);
          setDraft(undefined);
          setLoading(false);
        }
      })
      .catch((caught) => {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "Maps are unavailable.");
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [campaignId, initialMapId, isGameMaster, openMap, refreshList]);

  const selectedMarker = useMemo(() => {
    if (!draft || !selectedMarkerId) return undefined;
    for (const layer of draft.layers) {
      const marker = layer.markers.find((candidate) => candidate.id === selectedMarkerId);
      if (marker) return { layerId: layer.id, marker };
    }
    return undefined;
  }, [draft, selectedMarkerId]);

  function updateMarker(
    markerId: string,
    update: (marker: CampaignMapGmMarker) => CampaignMapGmMarker,
  ) {
    setDraft((current) =>
      current
        ? {
            ...current,
            layers: current.layers.map((layer) => ({
              ...layer,
              markers: layer.markers.map((marker) =>
                marker.id === markerId ? update(marker) : marker,
              ),
            })),
          }
        : current,
    );
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const saved = await saveCampaignMap({
        campaignId,
        mapId: draft.id,
        mutation: {
          access: draft.access,
          backgroundArtifactId: draft.backgroundArtifactId,
          description: draft.description,
          expectedVersion: draft.version,
          layers: draft.layers.map((layer) => ({
            id: layer.id,
            markers: layer.markers.map(
              ({ referenceStatus: _referenceStatus, ...marker }) => marker,
            ),
            name: layer.name,
            sortOrder: layer.sortOrder,
            visibility: layer.visibility,
          })),
          name: draft.name,
          role: draft.role,
        },
      });
      setLoadedMap(saved);
      setDraft(cloneGmMap(saved));
      await refreshList();
      setOptions(await loadCampaignMapAuthoringOptions(campaignId));
      setNotice("Map saved.");
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) {
        setError(
          "This Map changed in another window. Your edits are still here; reload the current Map before saving again.",
        );
      } else {
        setError(caught instanceof Error ? caught.message : "The Map was not saved.");
      }
    } finally {
      setBusy(false);
    }
  }

  const displayMap = draft ?? loadedMap;

  return (
    <section style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
      <header style={{ ...panelStyle, background: "#f6f5ef" }}>
        <h1 style={{ margin: 0 }}>Maps</h1>
        <p style={{ margin: 0 }}>
          Explore places, organize spatial notes and follow links between Maps.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {maps.map((map) => (
            <button
              aria-pressed={map.id === selectedMapId}
              key={map.id}
              onClick={() => void openMap(map.id)}
              type="button"
            >
              {map.name}
            </button>
          ))}
        </div>
        {maps.length === 0 ? (
          <p>
            {isGameMaster ? "Create the first Map for this Campaign." : "No Maps are shared yet."}
          </p>
        ) : null}
        {isGameMaster ? (
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!newMapName.trim()) return;
              setBusy(true);
              setError(undefined);
              try {
                const created = await createCampaignMap({
                  campaignId,
                  create: {
                    access: "gm_only",
                    backgroundArtifactId: null,
                    description: "",
                    name: newMapName,
                    role: "area",
                  },
                });
                setNewMapName("");
                await refreshList();
                setOptions(await loadCampaignMapAuthoringOptions(campaignId));
                setLoadedMap(created);
                setDraft(cloneGmMap(created));
                setSelectedMapId(created.id);
                onMapRouteChange(created.id);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "The Map was not created.");
              } finally {
                setBusy(false);
              }
            }}
            style={{ alignItems: "end", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
          >
            <label style={{ ...fieldStyle, flex: "1 1 15rem" }}>
              New Map name
              <input
                disabled={busy}
                maxLength={160}
                onChange={(event) => setNewMapName(event.target.value)}
                value={newMapName}
              />
            </label>
            <button disabled={busy || !newMapName.trim()} type="submit">
              Create Map
            </button>
          </form>
        ) : null}
      </header>

      {error ? (
        <section role="alert" style={{ ...panelStyle, borderColor: "#a74343" }}>
          {error}
          {draft && loadedMap ? (
            <button onClick={() => void openMap(loadedMap.id)} type="button">
              Reload current Map
            </button>
          ) : null}
        </section>
      ) : null}
      {notice ? <p role="status">{notice}</p> : null}
      {loading ? <p>Loading Maps…</p> : null}

      {!loading && displayMap ? (
        <>
          <section
            style={{
              ...panelStyle,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 16rem), 1fr))",
            }}
          >
            <div style={fieldStyle}>
              <strong>{displayMap.name}</strong>
              <span>{roleLabel(displayMap.role)}</span>
              <span>{displayMap.description || "No description yet."}</span>
            </div>
            {draft ? (
              <>
                <label style={fieldStyle}>
                  Map name
                  <input
                    maxLength={160}
                    onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    value={draft.name}
                  />
                </label>
                <label style={fieldStyle}>
                  Role
                  <select
                    onChange={(event) =>
                      setDraft({ ...draft, role: event.target.value as CampaignMapRole })
                    }
                    value={draft.role}
                  >
                    <option value="world_region">World or region</option>
                    <option value="area">Area</option>
                    <option value="tactical">Tactical reference</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  Player access
                  <select
                    onChange={(event) =>
                      setDraft({ ...draft, access: event.target.value as CampaignMapAccess })
                    }
                    value={draft.access}
                  >
                    <option value="gm_only">GM only</option>
                    <option value="players">Shared with players</option>
                  </select>
                </label>
                <label style={fieldStyle}>
                  Background
                  <select
                    onChange={(event) =>
                      setDraft({ ...draft, backgroundArtifactId: event.target.value || null })
                    }
                    value={draft.backgroundArtifactId ?? ""}
                  >
                    <option value="">No background</option>
                    {options?.artifacts.map((artifact) => (
                      <option key={artifact.id} value={artifact.id}>
                        {artifact.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={{ ...fieldStyle, gridColumn: "1 / -1" }}>
                  Description
                  <textarea
                    maxLength={4000}
                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    rows={3}
                    value={draft.description}
                  />
                </label>
              </>
            ) : null}
          </section>

          {draft?.background && !draft.background.playerCanView && draft.access === "players" ? (
            <p role="status">
              Players will receive a usable background-less Map until this Artifact is shared from
              the Artifact workspace.
            </p>
          ) : null}
          {draft?.background && !draft.background.available ? (
            <p role="status">The selected background is unavailable. Map content remains intact.</p>
          ) : null}

          <MapCanvas
            campaignId={campaignId}
            isGameMaster={Boolean(draft)}
            map={displayMap}
            onNavigate={(mapId) => void openMap(mapId)}
            onReposition={(x, y) => {
              if (selectedMarkerId)
                updateMarker(selectedMarkerId, (marker) => ({ ...marker, x, y }));
            }}
            onSelectMarker={setSelectedMarkerId}
            selectedMarkerId={selectedMarkerId}
          />

          {draft ? (
            <section
              style={{
                display: "grid",
                gap: "1rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
              }}
            >
              <section style={panelStyle}>
                <h2 style={{ margin: 0 }}>Layers</h2>
                {draft.layers.map((layer, index) => (
                  <div key={layer.id} style={{ ...panelStyle, padding: "0.75rem" }}>
                    <label style={fieldStyle}>
                      Layer name
                      <input
                        maxLength={160}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            layers: draft.layers.map((candidate) =>
                              candidate.id === layer.id
                                ? { ...candidate, name: event.target.value }
                                : candidate,
                            ),
                          })
                        }
                        value={layer.name}
                      />
                    </label>
                    <label style={fieldStyle}>
                      Layer visibility
                      <select
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            layers: draft.layers.map((candidate) =>
                              candidate.id === layer.id
                                ? {
                                    ...candidate,
                                    visibility: event.target.value as CampaignMapLayerVisibility,
                                  }
                                : candidate,
                            ),
                          })
                        }
                        value={layer.visibility}
                      >
                        <option value="gm_only">GM only</option>
                        <option value="player_visible">Player visible</option>
                      </select>
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <button
                        disabled={index === 0}
                        onClick={() => {
                          const next = [...draft.layers];
                          [next[index - 1], next[index]] = [next[index], next[index - 1]];
                          setDraft({
                            ...draft,
                            layers: next.map((entry, order) => ({ ...entry, sortOrder: order })),
                          });
                        }}
                        type="button"
                      >
                        Move up
                      </button>
                      <button
                        disabled={index === draft.layers.length - 1}
                        onClick={() => {
                          const next = [...draft.layers];
                          [next[index], next[index + 1]] = [next[index + 1], next[index]];
                          setDraft({
                            ...draft,
                            layers: next.map((entry, order) => ({ ...entry, sortOrder: order })),
                          });
                        }}
                        type="button"
                      >
                        Move down
                      </button>
                      <button
                        disabled={layer.markers.length > 0}
                        onClick={() =>
                          setDraft({
                            ...draft,
                            layers: draft.layers
                              .filter((candidate) => candidate.id !== layer.id)
                              .map((entry, order) => ({ ...entry, sortOrder: order })),
                          })
                        }
                        type="button"
                      >
                        Remove empty Layer
                      </button>
                    </div>
                    <small>{layer.markers.length} markers</small>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setDraft({
                      ...draft,
                      layers: [
                        ...draft.layers,
                        {
                          id: makeId("layer"),
                          markers: [],
                          name: `Layer ${draft.layers.length + 1}`,
                          sortOrder: draft.layers.length,
                          visibility: "gm_only",
                        },
                      ],
                    })
                  }
                  type="button"
                >
                  Add Layer
                </button>
              </section>

              <section style={panelStyle}>
                <h2 style={{ margin: 0 }}>Markers</h2>
                {draft.layers.length === 0 ? (
                  <p>Add a Layer before placing markers.</p>
                ) : (
                  <button
                    onClick={() => {
                      const layer = draft.layers[0];
                      if (!layer) return;
                      const marker: CampaignMapGmMarker = {
                        description: "",
                        destinationMapId: null,
                        entityLabelSnapshot: null,
                        entityReferenceId: null,
                        entityReferenceType: null,
                        id: makeId("marker"),
                        kind: "annotation",
                        label: "New marker",
                        presentation: "pin",
                        sortOrder: layer.markers.length,
                        visibility: "inherit",
                        x: 0.5,
                        y: 0.5,
                      };
                      setDraft({
                        ...draft,
                        layers: draft.layers.map((candidate) =>
                          candidate.id === layer.id
                            ? { ...candidate, markers: [...candidate.markers, marker] }
                            : candidate,
                        ),
                      });
                      setSelectedMarkerId(marker.id);
                    }}
                    type="button"
                  >
                    Add marker
                  </button>
                )}
                {selectedMarker ? (
                  <MarkerEditor
                    draft={draft}
                    marker={selectedMarker.marker}
                    onChange={(next) => updateMarker(selectedMarker.marker.id, () => next)}
                    onMoveLayer={(layerId) => {
                      const marker = selectedMarker.marker;
                      setDraft({
                        ...draft,
                        layers: draft.layers.map((layer) => {
                          const without = layer.markers.filter((entry) => entry.id !== marker.id);
                          return layer.id === layerId
                            ? {
                                ...layer,
                                markers: [...without, { ...marker, sortOrder: without.length }],
                              }
                            : {
                                ...layer,
                                markers: without.map((entry, order) => ({
                                  ...entry,
                                  sortOrder: order,
                                })),
                              };
                        }),
                      });
                    }}
                    onRemove={() => {
                      setDraft({
                        ...draft,
                        layers: draft.layers.map((layer) => ({
                          ...layer,
                          markers: layer.markers
                            .filter((marker) => marker.id !== selectedMarker.marker.id)
                            .map((marker, order) => ({ ...marker, sortOrder: order })),
                        })),
                      });
                      setSelectedMarkerId(undefined);
                    }}
                    options={options}
                    selectedLayerId={selectedMarker.layerId}
                  />
                ) : (
                  <p>Select a marker on the canvas to edit it.</p>
                )}
              </section>
            </section>
          ) : (
            <section style={panelStyle}>
              <h2 style={{ margin: 0 }}>Visible places</h2>
              {displayMap.layers.reduce((count, layer) => count + layer.markers.length, 0) === 0 &&
              (!("revealedMarkers" in displayMap) || displayMap.revealedMarkers.length === 0) ? (
                <p>No places have been revealed on this Map.</p>
              ) : (
                displayMap.layers.map((layer) => (
                  <section key={layer.id}>
                    <h3>{layer.name}</h3>
                    {layer.markers.map((marker) => (
                      <p key={marker.id}>{marker.label}</p>
                    ))}
                  </section>
                ))
              )}
              {"revealedMarkers" in displayMap && displayMap.revealedMarkers.length > 0 ? (
                <section>
                  <h3>Revealed places</h3>
                  {displayMap.revealedMarkers.map((marker) => (
                    <p key={marker.id}>{marker.label}</p>
                  ))}
                </section>
              ) : null}
            </section>
          )}

          {draft ? (
            <button disabled={busy || !draft.name.trim()} onClick={() => void save()} type="button">
              {busy ? "Saving…" : "Save Map"}
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MarkerEditor({
  draft,
  marker,
  onChange,
  onMoveLayer,
  onRemove,
  options,
  selectedLayerId,
}: {
  draft: CampaignMapGmDto;
  marker: CampaignMapGmMarker;
  onChange: (marker: CampaignMapGmMarker) => void;
  onMoveLayer: (layerId: string) => void;
  onRemove: () => void;
  options?: CampaignMapAuthoringOptions;
  selectedLayerId: string;
}) {
  function setKind(kind: CampaignMapMarkerKind) {
    const firstEntity = options?.entities[0];
    const firstDestination = options?.maps.find((map) => map.id !== draft.id);
    onChange({
      ...marker,
      destinationMapId: kind === "map_link" ? (firstDestination?.id ?? null) : null,
      entityLabelSnapshot: kind === "entity_reference" ? (firstEntity?.label ?? null) : null,
      entityReferenceId: kind === "entity_reference" ? (firstEntity?.id ?? null) : null,
      entityReferenceType: kind === "entity_reference" ? (firstEntity?.type ?? null) : null,
      kind,
    });
  }

  return (
    <div style={{ display: "grid", gap: "0.75rem" }}>
      <label style={fieldStyle}>
        Marker label
        <input
          maxLength={160}
          onChange={(event) => onChange({ ...marker, label: event.target.value })}
          value={marker.label}
        />
      </label>
      <label style={fieldStyle}>
        Kind
        <select
          onChange={(event) => setKind(event.target.value as CampaignMapMarkerKind)}
          value={marker.kind}
        >
          <option value="annotation">Annotation</option>
          <option value="entity_reference">Character or creature</option>
          <option value="map_link">Map link</option>
        </select>
      </label>
      <label style={fieldStyle}>
        Layer
        <select onChange={(event) => onMoveLayer(event.target.value)} value={selectedLayerId}>
          {draft.layers.map((layer) => (
            <option key={layer.id} value={layer.id}>
              {layer.name}
            </option>
          ))}
        </select>
      </label>
      <label style={fieldStyle}>
        Visibility
        <select
          onChange={(event) =>
            onChange({ ...marker, visibility: event.target.value as CampaignMapMarkerVisibility })
          }
          value={marker.visibility}
        >
          <option value="inherit">Follow Layer</option>
          <option value="gm_only">GM only</option>
          <option value="player_visible">Player visible</option>
        </select>
      </label>
      <label style={fieldStyle}>
        Symbol or short mark
        <input
          maxLength={40}
          onChange={(event) => onChange({ ...marker, presentation: event.target.value })}
          value={marker.presentation}
        />
      </label>
      <label style={fieldStyle}>
        Description
        <textarea
          maxLength={4000}
          onChange={(event) => onChange({ ...marker, description: event.target.value })}
          rows={3}
          value={marker.description}
        />
      </label>
      {marker.kind === "entity_reference" ? (
        <label style={fieldStyle}>
          Character or creature
          <select
            onChange={(event) => {
              const entity = options?.entities.find(
                (candidate) => candidate.id === event.target.value,
              );
              onChange({
                ...marker,
                entityLabelSnapshot: entity?.label ?? null,
                entityReferenceId: entity?.id ?? null,
                entityReferenceType: entity?.type ?? null,
              });
            }}
            value={marker.entityReferenceId ?? ""}
          >
            <option value="">Choose…</option>
            {options?.entities.map((entity) => (
              <option key={`${entity.type}:${entity.id}`} value={entity.id}>
                {entity.label}
              </option>
            ))}
          </select>
          {marker.referenceStatus === "unavailable" ? (
            <span role="status">Reference unavailable. The marker remains on the Map.</span>
          ) : null}
        </label>
      ) : null}
      {marker.kind === "map_link" ? (
        <label style={fieldStyle}>
          Destination Map
          <select
            onChange={(event) =>
              onChange({ ...marker, destinationMapId: event.target.value || null })
            }
            value={marker.destinationMapId ?? ""}
          >
            <option value="">Choose…</option>
            {options?.maps.map((map) => (
              <option key={map.id} value={map.id}>
                {map.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div style={{ display: "grid", gap: "0.5rem", gridTemplateColumns: "1fr 1fr" }}>
        <label style={fieldStyle}>
          Horizontal position
          <input
            max={1}
            min={0}
            onChange={(event) => onChange({ ...marker, x: Number(event.target.value) })}
            step={0.01}
            type="number"
            value={marker.x}
          />
        </label>
        <label style={fieldStyle}>
          Vertical position
          <input
            max={1}
            min={0}
            onChange={(event) => onChange({ ...marker, y: Number(event.target.value) })}
            step={0.01}
            type="number"
            value={marker.y}
          />
        </label>
      </div>
      <div aria-label="Move marker" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button
          onClick={() => onChange({ ...marker, x: Math.max(0, marker.x - 0.05) })}
          type="button"
        >
          Left
        </button>
        <button
          onClick={() => onChange({ ...marker, x: Math.min(1, marker.x + 0.05) })}
          type="button"
        >
          Right
        </button>
        <button
          onClick={() => onChange({ ...marker, y: Math.max(0, marker.y - 0.05) })}
          type="button"
        >
          Up
        </button>
        <button
          onClick={() => onChange({ ...marker, y: Math.min(1, marker.y + 0.05) })}
          type="button"
        >
          Down
        </button>
      </div>
      <button onClick={onRemove} type="button">
        Remove marker
      </button>
    </div>
  );
}

var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/utils/helpers.ts
function randomID(length = 16) {
  return foundry.utils.randomID(length);
}
function i18nLocalize(key, fallback = "") {
  return game.i18n?.localize(`${MODULE_ID}.${key}`) ?? fallback;
}
function i18nLocalizeFormat(key, format, fallback = "") {
  return game.i18n?.format(`${MODULE_ID}.${key}`, format) ?? fallback;
}
function getModule(_module = MODULE_ID) {
  const module = game.modules?.get(_module);
  if (!module) {
    throw new Error(`Module ${_module} not found`);
  }
  return module;
}
function getModuleApi(_module = MODULE_ID) {
  const module = getModule(_module);
  return module.api;
}
function registerHandlebarsHelpers() {
  try {
    const hb = globalThis.Handlebars;
    if (!hb) {
      console.warn("[planar-index] Handlebars not found to register helpers.");
      return;
    }
    if (!hb.helpers?.truncate) {
      hb.registerHelper("truncate", (text, max) => {
        const limit = Number(max) || 100;
        if (text == null) return "";
        const s = String(text);
        if (s.length <= limit) return s;
        return `${s.slice(0, limit).trimEnd()}\u2026`;
      });
    }
  } catch (err) {
    console.error("[planar-index] Failed to register Handlebars helpers:", err);
  }
}
function getActiveGmId() {
  const active = game.users?.find((u) => u.active && u.isGM)?.id;
  if (active) return active;
  return game.users?.find((u) => u.isGM)?.id;
}
function requireGmOrThrow() {
  if (!game.user?.isGM) throw new Error("Only the GM can perform this operation.");
}
var HandlebarsApplication, MODULE_ID, DialogV2, duplicate, FilePicker, notify;
var init_helpers = __esm({
  "src/utils/helpers.ts"() {
    "use strict";
    HandlebarsApplication = class extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    };
    MODULE_ID = "magic-planar-index";
    ({ DialogV2 } = foundry.applications.api);
    ({ duplicate } = foundry.utils);
    FilePicker = foundry.applications.apps.FilePicker.implementation;
    notify = {
      info(msg) {
        void ui?.notifications?.info(msg);
      },
      error(msg) {
        void ui?.notifications?.error(msg);
      },
      success(msg) {
        void ui?.notifications?.success(msg);
      },
      warn(msg) {
        void ui?.notifications?.warn(msg);
      }
    };
  }
});

// src/app/core/services/plane-flags.service.ts
var plane_flags_service_exports = {};
__export(plane_flags_service_exports, {
  countEnabledPlanes: () => countEnabledPlanes,
  getActorPlanes: () => getActorPlanes,
  getActorPlanesMeta: () => getActorPlanesMeta,
  getEnabledPlaneIds: () => getEnabledPlaneIds,
  isPlaneEnabled: () => isPlaneEnabled,
  requestTogglePlane: () => requestTogglePlane,
  setActorPlanes: () => setActorPlanes,
  toggleActorPlane: () => toggleActorPlane
});
function getActorPlanes(actor) {
  const flags = actor.getFlag(MODULE_ID, FLAG_KEY);
  return flags ?? {};
}
function getActorPlanesMeta(actor) {
  const meta = actor.getFlag(MODULE_ID, FLAG_META_KEY);
  return meta ?? {};
}
function isPlaneEnabled(actor, planeId) {
  const planes = getActorPlanes(actor);
  return planes[planeId] === true;
}
async function setActorPlanes(actor, planes, userId) {
  await actor.setFlag(MODULE_ID, FLAG_KEY, planes);
  await actor.setFlag(MODULE_ID, FLAG_META_KEY, {
    lastUpdatedBy: userId ?? game.user?.id,
    lastUpdatedAt: Date.now()
  });
}
async function toggleActorPlane(actor, planeId, enabled, userId) {
  const planes = getActorPlanes(actor);
  planes[planeId] = enabled;
  await setActorPlanes(actor, planes, userId);
}
async function requestTogglePlane(actorId, planeId, enabled) {
  const moduleApi = getModuleApi();
  const ws = moduleApi.werewolfSocket;
  const gmId = getActiveGmId();
  if (!gmId) {
    throw new Error("No GM available to process request");
  }
  try {
    const result = await ws.request(
      "pi:plane:toggle",
      { actorId, planeId, enabled },
      { targetUserId: gmId, loopback: game.user?.isGM }
    );
    return result.success;
  } catch (err) {
    console.error("[planar-index] Failed to toggle plane via RPC:", err);
    return false;
  }
}
function countEnabledPlanes(actor, planeIds) {
  const planes = getActorPlanes(actor);
  if (!planeIds) return Object.values(planes).filter(Boolean).length;
  return planeIds.reduce((count, id) => count + (planes[id] ? 1 : 0), 0);
}
function getEnabledPlaneIds(actor) {
  const planes = getActorPlanes(actor);
  return Object.entries(planes).filter(([, enabled]) => enabled).map(([id]) => id);
}
var FLAG_KEY, FLAG_META_KEY;
var init_plane_flags_service = __esm({
  "src/app/core/services/plane-flags.service.ts"() {
    "use strict";
    init_helpers();
    FLAG_KEY = "planes";
    FLAG_META_KEY = "planesMeta";
  }
});

// src/app/shared/services/socket/types/werewolf-socket.types.ts
var isResponse = (e) => !!e.response && !!e.requestId;

// src/app/shared/services/socket/domain/werewolf-socket.service.ts
init_helpers();
var CHANNEL = `module.${MODULE_ID}`;
var WerewolfSocketService = class {
  constructor(channel) {
    this.rpcWaiters = /* @__PURE__ */ new Map();
    this.boundHandler = (data) => this.dispatch(data);
    this.listeners = /* @__PURE__ */ new Map();
    this.middlewares = [];
    this.channel = channel;
  }
  init() {
    this.socket = game.socket;
    this.socket?.on(this.channel, this.boundHandler);
  }
  destroy() {
    this.socket?.off(this.channel, this.boundHandler);
    this.listeners.clear();
    this.rpcWaiters.clear();
  }
  use(mw) {
    this.middlewares.push(mw);
  }
  on(type, handler) {
    const set = this.listeners.get(type) ?? /* @__PURE__ */ new Set();
    set.add(handler);
    this.listeners.set(type, set);
    return () => {
      set.delete(handler);
    };
  }
  off(type, handler) {
    this.listeners.get(type)?.delete(handler);
  }
  emit(type, payload, opts) {
    const env = {
      type,
      payload,
      sender: game.user?.id ?? "",
      targetUserId: opts?.targetUserId
    };
    this.socket?.emit(this.channel, env);
    if (opts?.loopback !== false) this.dispatch(env);
  }
  request(type, payload, opts) {
    const requestId = randomID();
    const env = {
      type,
      payload,
      sender: game.user?.id ?? "",
      targetUserId: opts?.targetUserId,
      requestId
    };
    const timeoutMs = opts?.timeoutMs ?? 1e4;
    return new Promise((resolve, reject) => {
      const handler = (responseEnv) => {
        if (responseEnv.requestId !== requestId || !responseEnv.response) return;
        this.rpcWaiters.delete(requestId);
        if (responseEnv.response.ok) resolve(responseEnv.response.data);
        else reject(new Error(responseEnv.response.error ?? "Socket RPC failed!"));
      };
      this.rpcWaiters.set(requestId, handler);
      this.socket?.on(this.channel, handler);
      this.socket?.emit(this.channel, env);
      if (opts?.loopback !== false) this.dispatch(env);
      setTimeout(() => {
        if (!this.rpcWaiters.has(requestId)) return;
        this.socket?.off(this.channel, handler);
        this.rpcWaiters.delete(requestId);
        reject(new Error("Socket RPC timed out!"));
      }, timeoutMs);
    });
  }
  async dispatch(env) {
    if (env.targetUserId && env.targetUserId !== game.user?.id) return;
    if (isResponse(env) && env.requestId) {
      const waiter = this.rpcWaiters.get(env.requestId);
      if (waiter) {
        this.socket?.off(this.channel, waiter);
        waiter(env);
      }
      return;
    }
    const chain = [...this.middlewares];
    let idx = -1;
    const run = async () => {
      idx++;
      if (idx < chain.length) {
        await chain[idx](env, run);
      } else {
        const set = this.listeners.get(env.type);
        if (!set || set.size === 0) return;
        let answered = false;
        for (const handler of set) {
          const result = await handler(env);
          if (env.requestId && result !== void 0 && !answered) {
            answered = true;
            this.reply(env, { ok: true, data: result });
          }
        }
        if (env.requestId && !answered) this.reply(env, { ok: true });
      }
    };
    try {
      await run();
    } catch (err) {
      if (env.requestId) this.reply(env, { ok: false, error: err?.message ?? String(err) });
      else console.error(`[WerrewolfSocket] Error handling ${env.type}`);
    }
  }
  reply(to, response) {
    const responseEnv = {
      type: to.type,
      sender: game.user?.id || "",
      targetUserId: to.sender,
      requestId: to.requestId,
      response
    };
    this.socket?.emit(this.channel, responseEnv);
    if (to.sender === game.user?.id) {
      this.dispatch(responseEnv);
    }
  }
};

// src/main.ts
init_helpers();

// src/app/core/services/register.service.ts
init_helpers();

// src/app/features/planar-layout-editor/PlanarLayoutEditor.ts
init_helpers();

// src/app/shared/features/base/domain/base-form.ts
init_helpers();
var BaseForm = class extends HandlebarsApplication {
  #offRefresh;
  #refreshBound = false;
  viewId() {
    return this.constructor.name;
  }
  refreshKey() {
    return void 0;
  }
  static get DEFAULT_OPTIONS() {
    return {
      classes: [],
      tag: "div",
      window: {
        frame: true,
        positioned: true,
        title: "",
        icon: "",
        controls: [],
        minimizable: true,
        resizable: false,
        contentTag: "section",
        contentClasses: []
      },
      actions: {},
      form: {
        handler: void 0,
        submitOnChange: false,
        closeOnSubmit: false
      },
      position: {
        width: "auto",
        height: "auto"
      }
    };
  }
  static get PARTS() {
    return {
      content: {
        template: "",
        classes: [],
        scrollable: []
      }
    };
  }
  async _prepareContext(options) {
    return {};
  }
  async _onRender(context, options) {
    const moduleApi = getModuleApi();
    const ws = moduleApi.werewolfSocket;
    if (!this.#refreshBound) {
      this.#refreshBound = true;
      this.#offRefresh = ws.on("lw:refresh", async (env) => {
        const ev = env.payload;
        if (!ev) return;
        if (ev.view !== this.viewId()) return;
        const myKey = this.refreshKey();
        if (ev.key && myKey && ev.key !== myKey) return;
        try {
          await this.handleRefresh(ev);
        } catch (err) {
          console.error(`[BaseForm] handleRefresh error in ${this.viewId()}:`, err);
        }
      });
    }
  }
  async handleRefresh(ev) {
    await this.render(true);
  }
  async close(options) {
    try {
      if (this.#offRefresh) this.#offRefresh();
      return await super.close(options);
    } finally {
      this.#offRefresh = void 0;
      this.#refreshBound = false;
    }
  }
};

// src/app/core/net/refresh-bus.ts
init_helpers();
function emitRefresh(ev, opts) {
  const moduleApi = getModuleApi();
  const ws = moduleApi.werewolfSocket;
  ws.emit("lw:refresh", ev, {
    targetUserId: opts?.targetUserId ?? "",
    loopback: opts?.includeSelf === true
  });
}

// src/app/core/services/planar-layout.service.ts
init_helpers();

// src/app/core/data/planar-layout.ts
function slugify(name) {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}
function plane(name, x, y, category = "major") {
  return {
    id: slugify(name),
    name,
    x,
    y,
    category
  };
}
var PLANAR_LAYOUT = [
  // === CENTRAL HUB ===
  plane("Dominaria", 0.5, 0.48, "major"),
  // === INNER RING - Major Story Planes ===
  plane("Ravnica", 0.65, 0.35, "major"),
  plane("Zendikar", 0.72, 0.52, "major"),
  plane("Innistrad", 0.62, 0.65, "major"),
  plane("Mirrodin", 0.38, 0.65, "major"),
  plane("New Phyrexia", 0.28, 0.52, "major"),
  plane("Phyrexia", 0.35, 0.35, "major"),
  plane("Theros", 0.5, 0.28, "major"),
  // === SECOND RING - Popular Planes ===
  plane("Ixalan", 0.82, 0.38, "major"),
  plane("Amonkhet", 0.85, 0.55, "major"),
  plane("Kaladesh", 0.78, 0.68, "major"),
  plane("Tarkir", 0.65, 0.78, "major"),
  plane("Alara", 0.45, 0.78, "major"),
  plane("Lorwyn", 0.32, 0.75, "major"),
  plane("Shadowmoor", 0.22, 0.65, "major"),
  plane("Kamigawa", 0.18, 0.48, "major"),
  plane("Kaldheim", 0.22, 0.32, "major"),
  plane("Eldraine", 0.35, 0.22, "major"),
  plane("Ikoria", 0.55, 0.18, "major"),
  plane("Arcavios", 0.7, 0.22, "major"),
  plane("Strixhaven", 0.78, 0.28, "major"),
  plane("New Capenna", 0.88, 0.45, "major"),
  // === OUTER RING - Lesser Known Planes ===
  plane("Fiora", 0.92, 0.32, "minor"),
  plane("Kylem", 0.95, 0.48, "minor"),
  plane("Shandalar", 0.92, 0.62, "minor"),
  plane("Ulgrotha", 0.88, 0.75, "minor"),
  plane("Vryn", 0.78, 0.82, "minor"),
  plane("Mercadia", 0.62, 0.88, "minor"),
  plane("Rabiah", 0.48, 0.9, "minor"),
  plane("Segovia", 0.35, 0.88, "minor"),
  plane("Belenon", 0.22, 0.82, "minor"),
  plane("Iquatana", 0.12, 0.72, "minor"),
  plane("Regatha", 0.08, 0.55, "minor"),
  plane("Muraganda", 0.08, 0.4, "minor"),
  plane("Pyrulea", 0.12, 0.25, "minor"),
  plane("Xerex", 0.25, 0.15, "minor"),
  plane("Gobakhan", 0.42, 0.1, "minor"),
  plane("Ergamon", 0.58, 0.08, "minor"),
  plane("Kephalai", 0.72, 0.1, "minor"),
  plane("Kinshala", 0.85, 0.18, "minor"),
  // === EDGE PLANES - Obscure ===
  plane("Ir", 0.05, 0.28, "minor"),
  plane("Kolbahan", 0.05, 0.68, "minor"),
  plane("Equilor", 0.15, 0.9, "minor"),
  plane("Azgol", 0.28, 0.95, "minor"),
  plane("Moag", 0.5, 0.95, "minor"),
  plane("Tavelia", 0.72, 0.92, "minor"),
  plane("Meditation Realm", 0.88, 0.88, "minor"),
  // === SPECIAL - Cosmic Nodes ===
  plane("Blind Eternities", 0.5, 0.02, "special")
];
var PLANES_BY_ID = PLANAR_LAYOUT.reduce(
  (acc, plane2) => {
    acc[plane2.id] = plane2;
    return acc;
  },
  {}
);
var ALL_PLANE_IDS = PLANAR_LAYOUT.map((p) => p.id);
function validatePlanarLayout() {
  const errors = [];
  const seenIds = /* @__PURE__ */ new Set();
  for (const plane2 of PLANAR_LAYOUT) {
    if (seenIds.has(plane2.id)) {
      errors.push(`Duplicate plane ID: ${plane2.id}`);
    }
    seenIds.add(plane2.id);
    if (plane2.x < 0 || plane2.x > 1) {
      errors.push(`Plane ${plane2.id} has invalid x coordinate: ${plane2.x}`);
    }
    if (plane2.y < 0 || plane2.y > 1) {
      errors.push(`Plane ${plane2.id} has invalid y coordinate: ${plane2.y}`);
    }
    if (!plane2.name || plane2.name.trim() === "") {
      errors.push(`Plane ${plane2.id} has empty name`);
    }
  }
  const expectedCount = 48;
  if (PLANAR_LAYOUT.length !== expectedCount) {
    errors.push(`Expected ${expectedCount} planes, found ${PLANAR_LAYOUT.length}`);
  }
  return {
    valid: errors.length === 0,
    errors
  };
}

// src/app/core/services/planar-layout.service.ts
var VALID_CATEGORIES = ["major", "minor", "special"];
function extractPlanes(layout) {
  if (!layout) return null;
  const planes = Array.isArray(layout) ? layout : layout.planes;
  return Array.isArray(planes) ? planes : null;
}
function normalizePlane(plane2) {
  return {
    ...plane2,
    category: plane2.category ?? "minor",
    hidden: plane2.hidden === true
  };
}
function normalizePlanes(planes) {
  return planes.map(normalizePlane);
}
function normalizePlaneId(name) {
  return slugify(name);
}
function getDefaultLayout() {
  return normalizePlanes(duplicate(PLANAR_LAYOUT));
}
function getCustomLayout() {
  const g = game;
  const raw = g.settings.get(MODULE_ID, SETTINGS_KEYS.CustomPlanarLayout);
  const planes = extractPlanes(raw);
  if (!planes) return null;
  const normalized = normalizePlanes(duplicate(planes));
  const validation = validateLayout(normalized);
  if (!validation.valid) {
    console.warn("[planar-layout] Custom layout invalid, falling back to default:", validation.errors);
    return null;
  }
  return normalized;
}
function getEffectiveLayout() {
  return getCustomLayout() ?? getDefaultLayout();
}
async function saveCustomLayout(layout) {
  requireGmOrThrow();
  const g = game;
  const planes = extractPlanes(layout);
  if (!planes) throw new Error("Layout missing planes array.");
  const normalized = normalizePlanes(duplicate(planes));
  const validation = validateLayout(normalized);
  if (!validation.valid) throw new Error(validation.errors.join("; "));
  await g.settings.set(MODULE_ID, SETTINGS_KEYS.CustomPlanarLayout, { planes: normalized });
}
async function resetLayoutToDefault() {
  requireGmOrThrow();
  const g = game;
  await g.settings.set(MODULE_ID, SETTINGS_KEYS.CustomPlanarLayout, null);
}
function validateLayout(layout) {
  const planes = extractPlanes(layout);
  if (!planes) return { valid: false, errors: ["Layout missing planes array."] };
  const errors = [];
  const seen = /* @__PURE__ */ new Set();
  for (const plane2 of planes) {
    const id = (plane2.id ?? "").trim();
    const name = (plane2.name ?? "").trim();
    if (!id) errors.push("Plane id is empty.");
    if (!name) errors.push(`Plane ${id || "(unknown)"} has empty name.`);
    if (id) {
      if (seen.has(id)) errors.push(`Duplicate plane id: ${id}`);
      seen.add(id);
    }
    if (!Number.isFinite(plane2.x)) errors.push(`Plane ${id || "(unknown)"} has invalid x: ${plane2.x}`);
    if (!Number.isFinite(plane2.y)) errors.push(`Plane ${id || "(unknown)"} has invalid y: ${plane2.y}`);
    if (Number.isFinite(plane2.x) && (plane2.x < 0 || plane2.x > 1)) {
      errors.push(`Plane ${id || "(unknown)"} x out of bounds: ${plane2.x}`);
    }
    if (Number.isFinite(plane2.y) && (plane2.y < 0 || plane2.y > 1)) {
      errors.push(`Plane ${id || "(unknown)"} y out of bounds: ${plane2.y}`);
    }
    if (plane2.category && !VALID_CATEGORIES.includes(plane2.category)) {
      errors.push(`Plane ${id || "(unknown)"} has invalid category: ${plane2.category}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

// src/app/features/planar-layout-editor/PlanarLayoutEditor.ts
var PlanarLayoutEditor = class extends BaseForm {
  constructor() {
    super(...arguments);
    this.layout = [];
    this.hasCustomLayout = false;
    this.needsReload = true;
    this.searchFilter = "";
    this.sortMode = "default";
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.MIN_ZOOM = 0.5;
    this.MAX_ZOOM = 2;
    this.isPanning = false;
    this.panStartClientX = 0;
    this.panStartClientY = 0;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panMoved = false;
    this.isDraggingPlane = false;
    this.dragStartClientX = 0;
    this.dragStartClientY = 0;
    this.dragMoved = false;
  }
  viewId() {
    return "planar-layout-editor";
  }
  static get DEFAULT_OPTIONS() {
    const base = super.DEFAULT_OPTIONS;
    return {
      ...base,
      id: "planar-layout-editor",
      classes: [...base.classes ?? [], "planar-layout-editor"],
      window: {
        ...base.window,
        title: i18nLocalize("ui.layoutEditor.title"),
        icon: "fa-solid fa-diagram-project",
        resizable: true,
        minimizable: true
      },
      position: {
        ...base.position,
        width: 1200,
        height: 750
      }
    };
  }
  static get PARTS() {
    const base = super.PARTS;
    return {
      ...base,
      content: {
        ...base.content,
        template: `modules/${MODULE_ID}/templates/planar-layout-editor/planar-layout-editor.hbs`,
        classes: ["planar-layout-editor-content"],
        scrollable: []
      }
    };
  }
  async _prepareContext(options) {
    const isGm = game.user?.isGM ?? false;
    if (this.needsReload || this.layout.length === 0) this.reloadLayoutFromSettings();
    const planes = this.layout.map((plane2) => ({
      ...plane2,
      hidden: plane2.hidden === true,
      selected: plane2.id === this.selectedPlaneId
    }));
    const planeList = this.getSortedPlaneList().map((plane2) => ({
      ...plane2,
      hidden: plane2.hidden === true,
      selected: plane2.id === this.selectedPlaneId
    }));
    const sortOptions = [
      { value: "default", label: i18nLocalize("ui.layoutEditor.sort.default"), selected: this.sortMode === "default" },
      { value: "name", label: i18nLocalize("ui.layoutEditor.sort.name"), selected: this.sortMode === "name" },
      { value: "category", label: i18nLocalize("ui.layoutEditor.sort.category"), selected: this.sortMode === "category" }
    ];
    return {
      planes,
      planeList,
      hasCustomLayout: this.hasCustomLayout,
      layoutStatusLabel: this.hasCustomLayout ? i18nLocalize("ui.layoutEditor.status.custom") : i18nLocalize("ui.layoutEditor.status.default"),
      searchPlaceholder: i18nLocalize("ui.searchPlaceholder"),
      sortOptions,
      isGm
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    if (!game.user?.isGM) {
      notify.warn(i18nLocalize("notifications.gmOnly"));
      await this.close();
      return;
    }
    const element = this.element;
    if (!element) return;
    const mapContainer = element.querySelector(".planar-map-container");
    if (mapContainer) {
      this.bindMapInteractions(mapContainer);
      this.applyZoom(mapContainer);
    }
    this.bindSidebarActions(element);
    this.applySearchFilter();
    this.applySelection();
  }
  reloadLayoutFromSettings() {
    this.layout = getEffectiveLayout();
    this.hasCustomLayout = getCustomLayout() !== null;
    this.needsReload = false;
    this.syncSelectedPlane();
  }
  syncSelectedPlane() {
    if (this.selectedPlaneId && !this.layout.some((plane2) => plane2.id === this.selectedPlaneId)) {
      this.selectedPlaneId = void 0;
    }
  }
  getSortedPlaneList() {
    const planes = [...this.layout];
    if (this.sortMode === "name") {
      return planes.sort((a, b) => a.name.localeCompare(b.name));
    }
    if (this.sortMode === "category") {
      const order = { major: 0, minor: 1, special: 2 };
      return planes.sort((a, b) => (order[a.category ?? "minor"] ?? 99) - (order[b.category ?? "minor"] ?? 99) || a.name.localeCompare(b.name));
    }
    return planes;
  }
  bindMapInteractions(container) {
    const nodes = container.querySelectorAll(".planar-layout-node");
    nodes.forEach((node) => {
      node.addEventListener("pointerdown", (e) => this.onPlanePointerDown(e, node, container));
    });
    container.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.onMapZoom(e, container);
      },
      { passive: false }
    );
    container.addEventListener("pointerdown", (e) => this.onMapPointerDown(e, container));
    container.addEventListener("pointermove", (e) => this.onMapPointerMove(e, container));
    container.addEventListener("pointerup", (e) => this.onMapPointerEnd(e, container));
    container.addEventListener("pointercancel", (e) => this.onMapPointerEnd(e, container));
    const resetBtn = this.element?.querySelector(".planar-map-reset-btn");
    if (resetBtn) {
      resetBtn.addEventListener("click", (e) => {
        e.preventDefault();
        this.resetView(container);
      });
    }
  }
  bindSidebarActions(element) {
    const searchInput = element.querySelector(".planar-layout-search-input");
    if (searchInput) {
      searchInput.value = this.searchFilter;
      searchInput.addEventListener("input", () => {
        this.searchFilter = searchInput.value.toLowerCase().trim();
        this.applySearchFilter();
      });
    }
    const sortSelect = element.querySelector(".planar-layout-sort-select");
    if (sortSelect) {
      sortSelect.value = this.sortMode;
      sortSelect.addEventListener("change", () => {
        this.sortMode = sortSelect.value || "default";
        void this.render();
      });
    }
    element.querySelector(".planar-layout-save-btn")?.addEventListener("click", () => void this.saveLayout());
    element.querySelector(".planar-layout-cancel-btn")?.addEventListener("click", () => void this.reloadLayout());
    element.querySelector(".planar-layout-create-btn")?.addEventListener("click", () => void this.openCreateDialog());
    element.querySelector(".planar-layout-reset-btn")?.addEventListener("click", () => void this.resetLayout());
    element.querySelector(".planar-layout-export-btn")?.addEventListener("click", () => void this.exportLayout());
    element.querySelector(".planar-layout-import-btn")?.addEventListener("click", () => void this.importLayout());
    const list = element.querySelector(".planar-layout-plane-list");
    if (list) {
      list.addEventListener("click", (e) => {
        const target = e.target;
        if (!target) return;
        const actionBtn = target.closest("[data-action]");
        if (actionBtn) {
          e.preventDefault();
          const planeId = actionBtn.dataset.planeId;
          const action = actionBtn.dataset.action;
          if (!planeId || !action) return;
          if (action === "edit") void this.openEditDialog(planeId);
          if (action === "toggle-hidden") this.togglePlaneHidden(planeId);
          if (action === "delete") void this.deletePlane(planeId);
          return;
        }
        const item = target.closest(".plane-list-item");
        if (item?.dataset?.planeId) {
          this.setSelectedPlaneId(item.dataset.planeId);
        }
      });
    }
  }
  onPlanePointerDown(event, node, container) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const planeId = node.dataset.planeId;
    if (!planeId) return;
    this.isDraggingPlane = true;
    this.dragPlaneId = planeId;
    this.dragPlaneNode = node;
    this.dragMoved = false;
    this.dragStartClientX = event.clientX;
    this.dragStartClientY = event.clientY;
    this.setSelectedPlaneId(planeId);
    node.classList.add("dragging");
    container.setPointerCapture(event.pointerId);
  }
  onMapPointerDown(event, container) {
    if (event.button !== 0) return;
    if (event.target?.closest?.(".planar-layout-node")) return;
    event.preventDefault();
    this.isPanning = true;
    this.panMoved = false;
    this.panStartClientX = event.clientX;
    this.panStartClientY = event.clientY;
    this.panStartX = this.panX;
    this.panStartY = this.panY;
    container.classList.add("panning");
    container.setPointerCapture(event.pointerId);
  }
  onMapPointerMove(event, container) {
    if (this.isDraggingPlane) {
      event.preventDefault();
      if (!this.dragPlaneId || !this.dragPlaneNode) return;
      const dx2 = event.clientX - this.dragStartClientX;
      const dy2 = event.clientY - this.dragStartClientY;
      if (!this.dragMoved && Math.hypot(dx2, dy2) > 2) this.dragMoved = true;
      const { x, y } = this.getNormalizedPointerPosition(event, container);
      this.updatePlanePosition(this.dragPlaneId, x, y, this.dragPlaneNode);
      return;
    }
    if (!this.isPanning) return;
    event.preventDefault();
    const dx = event.clientX - this.panStartClientX;
    const dy = event.clientY - this.panStartClientY;
    if (!this.panMoved && Math.hypot(dx, dy) > 4) this.panMoved = true;
    this.panX = this.panStartX + dx;
    this.panY = this.panStartY + dy;
    this.applyZoom(container);
  }
  onMapPointerEnd(event, container) {
    if (this.isDraggingPlane) {
      this.isDraggingPlane = false;
      this.dragPlaneId = void 0;
      this.dragPlaneNode?.classList.remove("dragging");
      this.dragPlaneNode = void 0;
      try {
        container.releasePointerCapture(event.pointerId);
      } catch {
      }
      return;
    }
    if (!this.isPanning) return;
    this.isPanning = false;
    container.classList.remove("panning");
    try {
      container.releasePointerCapture(event.pointerId);
    } catch {
    }
  }
  onMapZoom(event, container) {
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const oldZoom = this.zoomLevel;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = oldZoom * factor;
    const newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, nextZoom));
    if (newZoom === oldZoom) return;
    const contentX = (mouseX - this.panX) / oldZoom;
    const contentY = (mouseY - this.panY) / oldZoom;
    this.zoomLevel = newZoom;
    this.panX = mouseX - contentX * newZoom;
    this.panY = mouseY - contentY * newZoom;
    this.applyZoom(container);
  }
  applyZoom(container) {
    const content = container.querySelector(".planar-map-content");
    if (!content) return;
    content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    content.style.transformOrigin = "0 0";
  }
  resetView(container) {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyZoom(container);
  }
  getNormalizedPointerPosition(event, container) {
    const rect = container.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const contentX = (mouseX - this.panX) / this.zoomLevel;
    const contentY = (mouseY - this.panY) / this.zoomLevel;
    return {
      x: this.clamp(contentX / rect.width, 0, 1),
      y: this.clamp(contentY / rect.height, 0, 1)
    };
  }
  updatePlanePosition(planeId, x, y, node) {
    const plane2 = this.layout.find((p) => p.id === planeId);
    if (!plane2) return;
    plane2.x = x;
    plane2.y = y;
    const targetNode = node ?? this.element?.querySelector(`.planar-layout-node[data-plane-id="${planeId}"]`);
    if (targetNode) {
      targetNode.style.left = `${x * 100}%`;
      targetNode.style.top = `${y * 100}%`;
    }
  }
  applySearchFilter() {
    const element = this.element;
    if (!element) return;
    const searchLower = this.searchFilter.toLowerCase();
    const nodes = element.querySelectorAll(".planar-layout-node");
    const listItems = element.querySelectorAll(".plane-list-item");
    nodes.forEach((node) => {
      const planeName = node.dataset.planeName?.toLowerCase() ?? "";
      const matches = searchLower === "" || planeName.includes(searchLower);
      node.classList.toggle("search-hidden", !matches);
      node.classList.toggle("search-match", matches && searchLower !== "");
    });
    listItems.forEach((item) => {
      const planeName = item.dataset.planeName?.toLowerCase() ?? "";
      const matches = searchLower === "" || planeName.includes(searchLower);
      item.classList.toggle("search-hidden", !matches);
    });
  }
  applySelection() {
    if (!this.selectedPlaneId) return;
    this.setSelectedPlaneId(this.selectedPlaneId);
  }
  setSelectedPlaneId(planeId) {
    this.selectedPlaneId = planeId;
    const element = this.element;
    if (!element) return;
    element.querySelectorAll(".planar-layout-node").forEach((node) => {
      node.classList.toggle("is-selected", node.dataset.planeId === planeId);
    });
    element.querySelectorAll(".plane-list-item").forEach((item) => {
      item.classList.toggle("is-selected", item.dataset.planeId === planeId);
    });
  }
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  normalizeCoordinate(value, fallback) {
    if (!Number.isFinite(value)) return fallback;
    return this.clamp(value, 0, 1);
  }
  async openCreateDialog() {
    const content = this.buildPlaneFormContent({
      mode: "create",
      name: "",
      id: "",
      category: "minor",
      x: 0.5,
      y: 0.5,
      hidden: false
    });
    const result = await DialogV2.prompt({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.createTitle"), resizable: false },
      content,
      ok: {
        label: i18nLocalize("ui.layoutEditor.buttons.create"),
        icon: '<i class="fa-solid fa-plus"></i>',
        callback: (_evt, btn) => this.getPlaneFormValues(btn.form)
      },
      cancel: {
        label: i18nLocalize("ui.layoutEditor.buttons.cancel"),
        callback: () => null
      },
      rejectClose: false
    });
    if (!result) return;
    const name = result.name.trim();
    if (!name) return notify.error(i18nLocalize("notifications.layoutMissingName"));
    const generatedId = normalizePlaneId(name);
    const id = (result.id.trim() || generatedId).trim();
    if (!id) return notify.error(i18nLocalize("notifications.layoutMissingId"));
    if (this.layout.some((plane3) => plane3.id === id)) {
      return notify.error(i18nLocalizeFormat("notifications.layoutDuplicateId", { id }));
    }
    const plane2 = {
      id,
      name,
      category: this.normalizeCategory(result.category),
      x: this.normalizeCoordinate(result.x, 0.5),
      y: this.normalizeCoordinate(result.y, 0.5),
      hidden: result.hidden
    };
    this.layout.push(plane2);
    this.selectedPlaneId = plane2.id;
    await this.render();
  }
  async openEditDialog(planeId) {
    const plane2 = this.layout.find((p) => p.id === planeId);
    if (!plane2) return;
    const content = this.buildPlaneFormContent({
      mode: "edit",
      name: plane2.name,
      id: plane2.id,
      category: plane2.category ?? "minor",
      x: plane2.x,
      y: plane2.y,
      hidden: plane2.hidden === true
    });
    const result = await DialogV2.prompt({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.editTitle"), resizable: false },
      content,
      ok: {
        label: i18nLocalize("ui.layoutEditor.buttons.save"),
        icon: '<i class="fa-solid fa-check"></i>',
        callback: (_evt, btn) => this.getPlaneFormValues(btn.form)
      },
      cancel: {
        label: i18nLocalize("ui.layoutEditor.buttons.cancel"),
        callback: () => null
      },
      rejectClose: false
    });
    if (!result) return;
    const name = result.name.trim();
    if (!name) return notify.error(i18nLocalize("notifications.layoutMissingName"));
    plane2.name = name;
    plane2.category = this.normalizeCategory(result.category);
    plane2.hidden = result.hidden;
    plane2.x = this.normalizeCoordinate(result.x, plane2.x);
    plane2.y = this.normalizeCoordinate(result.y, plane2.y);
    await this.render();
  }
  getPlaneFormValues(form) {
    if (!form) return null;
    const elements = form.elements;
    const name = String(elements.name?.value ?? "");
    const id = String(elements.id?.value ?? "");
    const category = String(elements.category?.value ?? "minor");
    const x = Number(elements.x?.value ?? 0);
    const y = Number(elements.y?.value ?? 0);
    const hidden = Boolean(elements.hidden?.checked);
    return { name, id, category, x, y, hidden };
  }
  normalizeCategory(category) {
    if (category === "major" || category === "minor" || category === "special") return category;
    return "minor";
  }
  buildPlaneFormContent(data) {
    const esc = foundry.utils.escapeHTML;
    const name = esc(data.name ?? "");
    const id = esc(data.id ?? "");
    const x = Number.isFinite(data.x) ? data.x.toFixed(2) : "0.50";
    const y = Number.isFinite(data.y) ? data.y.toFixed(2) : "0.50";
    const isEdit = data.mode === "edit";
    const idNote = isEdit ? i18nLocalize("ui.layoutEditor.dialog.idLocked") : i18nLocalize("ui.layoutEditor.dialog.idHint");
    return `
      <div class="planar-layout-dialog">
        <div class="form-group form-grid">
          <label for="plane-name">${i18nLocalize("ui.layoutEditor.fields.name")}</label>
          <div class="form-fields">
            <input id="plane-name" name="name" type="text" value="${name}" required />
          </div>
        </div>
        <div class="form-group form-grid">
          <label for="plane-id">${i18nLocalize("ui.layoutEditor.fields.id")}</label>
          <div class="form-fields">
            <input id="plane-id" name="id" type="text" value="${id}" ${isEdit ? "readonly" : ""} />
          </div>
          <p class="notes">${idNote}</p>
        </div>
        <div class="form-group form-grid">
          <label for="plane-category">${i18nLocalize("ui.layoutEditor.fields.category")}</label>
          <div class="form-fields">
            <select id="plane-category" name="category">
              <option value="major" ${data.category === "major" ? "selected" : ""}>${i18nLocalize("ui.legend.major")}</option>
              <option value="minor" ${data.category === "minor" ? "selected" : ""}>${i18nLocalize("ui.legend.minor")}</option>
              <option value="special" ${data.category === "special" ? "selected" : ""}>${i18nLocalize("ui.legend.special")}</option>
            </select>
          </div>
        </div>
        <div class="form-group form-grid">
          <label for="plane-x">${i18nLocalize("ui.layoutEditor.fields.x")}</label>
          <div class="form-fields">
            <input id="plane-x" name="x" type="number" step="0.01" min="0" max="1" value="${x}" />
          </div>
        </div>
        <div class="form-group form-grid">
          <label for="plane-y">${i18nLocalize("ui.layoutEditor.fields.y")}</label>
          <div class="form-fields">
            <input id="plane-y" name="y" type="number" step="0.01" min="0" max="1" value="${y}" />
          </div>
        </div>
        <div class="form-group form-grid is-checkbox">
          <label for="plane-hidden">${i18nLocalize("ui.layoutEditor.fields.hidden")}</label>
          <div class="form-fields">
            <input id="plane-hidden" name="hidden" type="checkbox" ${data.hidden ? "checked" : ""} />
          </div>
        </div>
      </div>
    `;
  }
  async deletePlane(planeId) {
    const plane2 = this.layout.find((p) => p.id === planeId);
    if (!plane2) return;
    const confirmed = await DialogV2.confirm({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.deleteTitle") },
      content: `<p>${i18nLocalizeFormat("ui.layoutEditor.dialog.deleteConfirm", { name: foundry.utils.escapeHTML(plane2.name) })}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    this.layout = this.layout.filter((p) => p.id !== planeId);
    if (this.selectedPlaneId === planeId) this.selectedPlaneId = void 0;
    await this.render();
  }
  togglePlaneHidden(planeId) {
    const plane2 = this.layout.find((p) => p.id === planeId);
    if (!plane2) return;
    plane2.hidden = !plane2.hidden;
    void this.render();
  }
  async saveLayout() {
    const validation = validateLayout(this.layout);
    if (!validation.valid) {
      notify.error(i18nLocalizeFormat("notifications.layoutInvalid", { errors: validation.errors.join("; ") }));
      return;
    }
    try {
      await saveCustomLayout(this.layout);
      this.needsReload = true;
      this.reloadLayoutFromSettings();
      notify.success(i18nLocalize("notifications.layoutSaved"));
      this.emitLayoutRefresh("layout-updated");
      await this.render();
    } catch (err) {
      notify.error(i18nLocalizeFormat("notifications.layoutSaveFailed", { error: err?.message ?? String(err) }));
    }
  }
  async reloadLayout() {
    this.needsReload = true;
    await this.render();
  }
  async resetLayout() {
    const confirmed = await DialogV2.confirm({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.resetTitle") },
      content: `<p>${i18nLocalize("ui.layoutEditor.dialog.resetConfirm")}</p>`,
      rejectClose: false
    });
    if (!confirmed) return;
    await resetLayoutToDefault();
    this.layout = getDefaultLayout();
    this.hasCustomLayout = false;
    this.syncSelectedPlane();
    notify.success(i18nLocalize("notifications.layoutReset"));
    this.emitLayoutRefresh("layout-reset");
    await this.render();
  }
  async exportLayout() {
    const payload = JSON.stringify({ planes: this.layout }, null, 2);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload);
        notify.success(i18nLocalize("notifications.layoutCopied"));
        return;
      }
    } catch {
    }
    const escaped = foundry.utils.escapeHTML(payload);
    await DialogV2.prompt({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.exportTitle"), resizable: true },
      content: `
        <div class="planar-layout-dialog">
          <div class="form-group">
            <textarea name="export" rows="18" style="width:100%;resize:vertical;">${escaped}</textarea>
          </div>
        </div>
      `,
      ok: {
        label: i18nLocalize("ui.layoutEditor.buttons.close"),
        icon: '<i class="fa-solid fa-check"></i>',
        callback: () => true
      },
      cancel: {
        label: i18nLocalize("ui.layoutEditor.buttons.cancel"),
        callback: () => false
      },
      rejectClose: false
    });
  }
  async importLayout() {
    const result = await DialogV2.prompt({
      window: { title: i18nLocalize("ui.layoutEditor.dialog.importTitle"), resizable: true },
      content: `
        <div class="planar-layout-dialog">
          <div class="form-group">
            <label for="layout-json">${i18nLocalize("ui.layoutEditor.dialog.importHint")}</label>
            <textarea id="layout-json" name="layout-json" rows="12" style="width:100%;resize:vertical;"></textarea>
          </div>
        </div>
      `,
      ok: {
        label: i18nLocalize("ui.layoutEditor.buttons.import"),
        icon: '<i class="fa-solid fa-file-import"></i>',
        callback: (_evt, btn) => {
          const value = String(btn.form?.elements?.["layout-json"]?.value ?? "");
          return value.trim();
        }
      },
      cancel: {
        label: i18nLocalize("ui.layoutEditor.buttons.cancel"),
        callback: () => ""
      },
      rejectClose: false
    });
    if (!result) return;
    let parsed;
    try {
      parsed = JSON.parse(result);
    } catch (err) {
      notify.error(i18nLocalizeFormat("notifications.layoutImportFailed", { error: err?.message ?? "Invalid JSON" }));
      return;
    }
    const planes = Array.isArray(parsed) ? parsed : parsed?.planes;
    if (!Array.isArray(planes)) {
      notify.error(i18nLocalize("notifications.layoutImportInvalid"));
      return;
    }
    const validation = validateLayout(planes);
    if (!validation.valid) {
      notify.error(i18nLocalizeFormat("notifications.layoutInvalid", { errors: validation.errors.join("; ") }));
      return;
    }
    try {
      await saveCustomLayout(planes);
      this.needsReload = true;
      this.reloadLayoutFromSettings();
      notify.success(i18nLocalize("notifications.layoutImported"));
      this.emitLayoutRefresh("layout-imported");
      await this.render();
    } catch (err) {
      notify.error(i18nLocalizeFormat("notifications.layoutSaveFailed", { error: err?.message ?? String(err) }));
    }
  }
  emitLayoutRefresh(reason) {
    emitRefresh({ view: "planar-index", reason }, { includeSelf: true });
  }
};

// src/app/core/services/register.service.ts
var SETTINGS_KEYS = {
  EditPermission: "editPermission",
  OwnedActorsOnly: "ownedActorsOnly",
  CustomBackground: "customBackground",
  PlanarIndexWindowSize: "planarIndexWindowSize",
  CustomPlanarLayout: "customPlanarLayout"
};
var PLANAR_INDEX_DEFAULT_SIZE = {
  width: 900,
  height: 700
};
function registerSettings() {
  const g = game;
  g.settings.register(MODULE_ID, SETTINGS_KEYS.EditPermission, {
    name: i18nLocalize("settings.editPermission.name"),
    hint: i18nLocalize("settings.editPermission.hint"),
    scope: "world",
    config: true,
    type: String,
    choices: {
      gm: i18nLocalize("settings.editPermission.choices.gm"),
      trusted: i18nLocalize("settings.editPermission.choices.trusted"),
      all: i18nLocalize("settings.editPermission.choices.all")
    },
    default: "gm",
    requiresReload: false
  });
  g.settings.register(MODULE_ID, SETTINGS_KEYS.OwnedActorsOnly, {
    name: i18nLocalize("settings.ownedActorsOnly.name"),
    hint: i18nLocalize("settings.ownedActorsOnly.hint"),
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false
  });
  g.settings.register(MODULE_ID, SETTINGS_KEYS.CustomBackground, {
    name: i18nLocalize("settings.customBackground.name"),
    hint: i18nLocalize("settings.customBackground.hint"),
    scope: "world",
    config: true,
    type: String,
    default: "",
    requiresReload: false
  });
  g.settings.register(MODULE_ID, SETTINGS_KEYS.PlanarIndexWindowSize, {
    name: i18nLocalize("settings.planarIndexWindowSize.name"),
    hint: i18nLocalize("settings.planarIndexWindowSize.hint"),
    scope: "client",
    config: false,
    type: Object,
    default: { ...PLANAR_INDEX_DEFAULT_SIZE },
    requiresReload: false
  });
  g.settings.register(MODULE_ID, SETTINGS_KEYS.CustomPlanarLayout, {
    name: i18nLocalize("settings.customPlanarLayout.name"),
    hint: i18nLocalize("settings.customPlanarLayout.hint"),
    scope: "world",
    config: false,
    default: null,
    requiresReload: false
  });
  g.settings.registerMenu(MODULE_ID, "planarLayoutEditor", {
    name: i18nLocalize("settings.layoutEditorMenu.name"),
    label: i18nLocalize("settings.layoutEditorMenu.label"),
    hint: i18nLocalize("settings.layoutEditorMenu.hint"),
    icon: "fa-solid fa-diagram-project",
    type: PlanarLayoutEditor,
    restricted: true
  });
}
function getEditPermission() {
  const g = game;
  return g.settings.get(MODULE_ID, SETTINGS_KEYS.EditPermission);
}
function getOwnedActorsOnly() {
  const g = game;
  return g.settings.get(MODULE_ID, SETTINGS_KEYS.OwnedActorsOnly);
}
function getCustomBackground() {
  const g = game;
  return g.settings.get(MODULE_ID, SETTINGS_KEYS.CustomBackground);
}
function getPlanarIndexWindowSize() {
  const g = game;
  const value = g.settings.get(MODULE_ID, SETTINGS_KEYS.PlanarIndexWindowSize);
  if (!value || typeof value.width !== "number" || typeof value.height !== "number") {
    return { ...PLANAR_INDEX_DEFAULT_SIZE };
  }
  return { width: value.width, height: value.height };
}
async function setPlanarIndexWindowSize(size) {
  const g = game;
  await g.settings.set(MODULE_ID, SETTINGS_KEYS.PlanarIndexWindowSize, size);
}
function canUserEditPlanes(user, actor) {
  if (user.isGM) return true;
  const permission = getEditPermission();
  if (permission === "gm") return false;
  if (permission === "trusted") {
    const isTrusted = user.role >= CONST.USER_ROLES.TRUSTED;
    if (!isTrusted) return false;
  }
  if (getOwnedActorsOnly()) {
    const isOwner = actor.testUserPermission(user, "OWNER");
    if (!isOwner) return false;
  }
  return true;
}

// src/app/core/services/sheet-buttons.service.ts
init_helpers();

// src/app/features/planar-index/PlanarIndex.ts
init_helpers();
init_plane_flags_service();
var PlanarIndex = class extends BaseForm {
  constructor(actor, options) {
    super(options);
    this.searchFilter = "";
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.MIN_ZOOM = 0.5;
    this.MAX_ZOOM = 2;
    this.isPanning = false;
    this.panStartClientX = 0;
    this.panStartClientY = 0;
    this.panStartX = 0;
    this.panStartY = 0;
    this.panMoved = false;
    this.suppressNextClick = false;
    this.actor = actor;
    this.lastWindowSize = getPlanarIndexWindowSize();
    this.saveWindowSizeDebounced = foundry.utils.debounce((size) => {
      this.lastWindowSize = size;
      void setPlanarIndexWindowSize(size);
    }, 200);
  }
  viewId() {
    return "planar-index";
  }
  refreshKey() {
    return this.actor.id ?? void 0;
  }
  static get DEFAULT_OPTIONS() {
    const base = super.DEFAULT_OPTIONS;
    const { width, height } = getPlanarIndexWindowSize();
    return {
      ...base,
      id: "planar-index-app",
      classes: [...base.classes ?? [], "planar-index"],
      window: {
        ...base.window,
        title: i18nLocalize("ui.title"),
        icon: "fa-solid fa-globe",
        resizable: true,
        minimizable: true
      },
      position: {
        ...base.position,
        width,
        height
      }
    };
  }
  static get PARTS() {
    const base = super.PARTS;
    return {
      ...base,
      content: {
        ...base.content,
        template: `modules/${MODULE_ID}/templates/planar-index/planar-index.hbs`,
        classes: ["planar-index-content"],
        scrollable: []
      }
    };
  }
  async _prepareContext(options) {
    const actorPlanes = getActorPlanes(this.actor);
    const user = game.user;
    const canEdit = canUserEditPlanes(user, this.actor);
    const customBackground = getCustomBackground();
    const layout = getEffectiveLayout();
    const visibleLayout = layout.filter((plane2) => !plane2.hidden);
    const visiblePlaneIds = visibleLayout.map((plane2) => plane2.id);
    const planes = visibleLayout.map((plane2) => ({
      ...plane2,
      enabled: actorPlanes[plane2.id] === true
    }));
    return {
      actor: this.actor,
      actorName: this.actor.name ?? "Unknown",
      actorId: this.actor.id ?? "",
      planes,
      enabledCount: countEnabledPlanes(this.actor, visiblePlaneIds),
      totalCount: visiblePlaneIds.length,
      canEdit,
      customBackground,
      searchPlaceholder: i18nLocalize("ui.searchPlaceholder")
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    const element = this.element;
    if (!element) return;
    const mapContainer = element.querySelector(".planar-map-container");
    const planeNodes = element.querySelectorAll(".plane-node");
    console.log("[planar-index] Found plane nodes:", planeNodes.length);
    if (mapContainer) {
      mapContainer.addEventListener("click", (e) => {
        if (this.suppressNextClick) {
          this.suppressNextClick = false;
          return;
        }
        const clickedNode = this._findPlaneNodeAtPoint(e, mapContainer, planeNodes);
        if (clickedNode) {
          console.log("[planar-index] Found plane at click:", clickedNode.dataset.planeId);
          this._onPlaneClick(e, clickedNode);
        }
      });
      mapContainer.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this._onMapZoom(e, mapContainer);
        },
        { passive: false }
      );
      const onPanEnd = (e) => {
        if (!this.isPanning) return;
        this.isPanning = false;
        mapContainer.classList.remove("panning");
        try {
          mapContainer.releasePointerCapture(e.pointerId);
        } catch {
        }
        if (this.panMoved) this.suppressNextClick = true;
      };
      mapContainer.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        const target = e.target;
        if (target?.closest?.(".plane-node")) return;
        e.preventDefault();
        this.isPanning = true;
        this.panMoved = false;
        this.panStartClientX = e.clientX;
        this.panStartClientY = e.clientY;
        this.panStartX = this.panX;
        this.panStartY = this.panY;
        mapContainer.classList.add("panning");
        mapContainer.setPointerCapture(e.pointerId);
      });
      mapContainer.addEventListener("pointermove", (e) => {
        if (!this.isPanning) return;
        e.preventDefault();
        const dx = e.clientX - this.panStartClientX;
        const dy = e.clientY - this.panStartClientY;
        if (!this.panMoved && Math.hypot(dx, dy) > 4) this.panMoved = true;
        this.panX = this.panStartX + dx;
        this.panY = this.panStartY + dy;
        this._applyZoom(mapContainer);
      });
      mapContainer.addEventListener("pointerup", onPanEnd);
      mapContainer.addEventListener("pointercancel", onPanEnd);
      const customBg = context.customBackground;
      if (customBg) {
        mapContainer.style.backgroundImage = `url('${customBg}')`;
      }
      this._applyZoom(mapContainer);
      const resetBtn = element.querySelector(".planar-reset-btn");
      if (resetBtn) {
        resetBtn.addEventListener("click", (e) => {
          e.preventDefault();
          this._resetView(mapContainer);
        });
      }
    }
    const searchInput = element.querySelector(".planar-search-input");
    if (searchInput) {
      searchInput.value = this.searchFilter;
      searchInput.addEventListener("input", (e) => this._onSearchInput(e, searchInput));
    }
    if (this.searchFilter) {
      this._applySearchFilter();
    }
  }
  _onPosition(options) {
    super._onPosition(options);
    if (this.minimized) return;
    const { width, height } = this.position;
    if (typeof width !== "number" || typeof height !== "number") return;
    const nextSize = { width: Math.round(width), height: Math.round(height) };
    if (nextSize.width <= 0 || nextSize.height <= 0) return;
    if (nextSize.width === this.lastWindowSize.width && nextSize.height === this.lastWindowSize.height) return;
    this.saveWindowSizeDebounced(nextSize);
  }
  async _onPlaneClick(event, node) {
    event.preventDefault();
    event.stopPropagation();
    const planeId = node.dataset.planeId;
    console.log("[planar-index] _onPlaneClick called, planeId:", planeId);
    if (!planeId) return;
    const user = game.user;
    const canEdit = canUserEditPlanes(user, this.actor);
    console.log("[planar-index] canEdit:", canEdit, "user.isGM:", user.isGM);
    if (!canEdit) {
      notify.warn(i18nLocalize("notifications.noPermission"));
      return;
    }
    const currentPlanes = getActorPlanes(this.actor);
    const currentEnabled = currentPlanes[planeId] === true;
    const newEnabled = !currentEnabled;
    this._updateNodeVisual(node, newEnabled);
    try {
      if (user.isGM) {
        await toggleActorPlane(this.actor, planeId, newEnabled, user.id ?? void 0);
        emitRefresh({ view: "planar-index", key: this.actor.id ?? void 0, reason: "plane-toggled" }, { includeSelf: false });
      } else {
        const success = await requestTogglePlane(this.actor.id ?? "", planeId, newEnabled);
        if (!success) {
          this._updateNodeVisual(node, currentEnabled);
          notify.error(i18nLocalize("notifications.toggleFailed"));
          return;
        }
      }
      this._updateCounter();
    } catch (err) {
      console.error("[planar-index] Failed to toggle plane:", err);
      this._updateNodeVisual(node, currentEnabled);
      notify.error(i18nLocalize("notifications.toggleFailed"));
    }
  }
  _onPlaneKeydown(event, node) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      this._onPlaneClick(event, node);
    }
  }
  _onSearchInput(event, input) {
    this.searchFilter = input.value.toLowerCase().trim();
    this._applySearchFilter();
  }
  _applySearchFilter() {
    const element = this.element;
    if (!element) return;
    const nodes = element.querySelectorAll(".plane-node");
    const searchLower = this.searchFilter.toLowerCase();
    nodes.forEach((node) => {
      const planeName = node.dataset.planeName?.toLowerCase() ?? "";
      const matches = searchLower === "" || planeName.includes(searchLower);
      if (matches) {
        node.classList.remove("search-hidden");
        node.classList.add("search-match");
      } else {
        node.classList.add("search-hidden");
        node.classList.remove("search-match");
      }
    });
  }
  _updateNodeVisual(node, enabled) {
    if (enabled) {
      node.classList.add("enabled");
      node.classList.remove("disabled");
      node.setAttribute("aria-checked", "true");
    } else {
      node.classList.remove("enabled");
      node.classList.add("disabled");
      node.setAttribute("aria-checked", "false");
    }
  }
  _updateCounter() {
    const element = this.element;
    if (!element) return;
    const counter = element.querySelector(".plane-counter");
    if (counter) {
      const visiblePlaneIds = getEffectiveLayout().filter((plane2) => !plane2.hidden).map((plane2) => plane2.id);
      const count = countEnabledPlanes(this.actor, visiblePlaneIds);
      counter.textContent = `${count} / ${visiblePlaneIds.length}`;
    }
  }
  _findPlaneNodeAtPoint(event, container, nodes) {
    const containerRect = container.getBoundingClientRect();
    const clickX = event.clientX - containerRect.left;
    const clickY = event.clientY - containerRect.top;
    const contentX = (clickX - this.panX) / this.zoomLevel;
    const contentY = (clickY - this.panY) / this.zoomLevel;
    const hitRadius = 30 / this.zoomLevel;
    for (const node of nodes) {
      const leftPercent = parseFloat(node.style.left) / 100;
      const topPercent = parseFloat(node.style.top) / 100;
      const nodeX = leftPercent * containerRect.width;
      const nodeY = topPercent * containerRect.height;
      const distance = Math.sqrt(Math.pow(contentX - nodeX, 2) + Math.pow(contentY - nodeY, 2));
      if (distance <= hitRadius) return node;
    }
    return null;
  }
  _onMapZoom(event, container) {
    const containerRect = container.getBoundingClientRect();
    const mouseX = event.clientX - containerRect.left;
    const mouseY = event.clientY - containerRect.top;
    const oldZoom = this.zoomLevel;
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const nextZoom = oldZoom * factor;
    const newZoom = Math.max(this.MIN_ZOOM, Math.min(this.MAX_ZOOM, nextZoom));
    if (newZoom === oldZoom) return;
    const contentX = (mouseX - this.panX) / oldZoom;
    const contentY = (mouseY - this.panY) / oldZoom;
    this.zoomLevel = newZoom;
    this.panX = mouseX - contentX * newZoom;
    this.panY = mouseY - contentY * newZoom;
    this._applyZoom(container);
  }
  _applyZoom(container) {
    const content = container.querySelector(".planar-map-content");
    if (!content) return;
    content.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    content.style.transformOrigin = "0 0";
  }
  _resetView(container) {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this._applyZoom(container);
  }
  async handleRefresh(ev) {
    await this.render(true);
  }
  /**
   * Get the actor this UI is managing
   */
  getActor() {
    return this.actor;
  }
};
function openPlanarIndex(actor) {
  const app = new PlanarIndex(actor);
  app.render(true);
}

// src/app/core/services/sheet-buttons.service.ts
init_plane_flags_service();
function registerSheetButtonHooks() {
  Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
    const actor = sheet.actor || sheet.object;
    if (!actor) return;
    buttons.unshift({
      label: i18nLocalize("ui.headerButton"),
      class: "planar-index-btn",
      icon: "fas fa-globe",
      onclick: () => openPlanarIndex(actor)
    });
  });
  Hooks.on("getHeaderControlsActorSheetV2", (app, controls) => {
    const actor = app.actor || app.document;
    if (!actor) return;
    controls.unshift({
      label: i18nLocalize("ui.headerButton"),
      class: "planar-index-btn",
      icon: "fas fa-globe",
      onClick: () => openPlanarIndex(actor)
    });
  });
}

// src/app/features/planar-index/gm-planar-rpc.ts
init_helpers();
init_plane_flags_service();
function registerGmPlanarRpc() {
  if (!game.user?.isGM) return;
  const moduleApi = getModuleApi();
  const ws = moduleApi.werewolfSocket;
  ws.on("pi:plane:toggle", async (env) => {
    requireGmOrThrow();
    const payload = env.payload;
    const { actorId, planeId, enabled } = payload;
    const actor = game.actors?.get(actorId);
    if (!actor) {
      console.warn(`[planar-index] Actor ${actorId} not found`);
      return { success: false, actorId, planeId, enabled: false };
    }
    const requestingUser = game.users?.get(env.sender);
    if (requestingUser && !canUserEditPlanes(requestingUser, actor)) {
      console.warn(`[planar-index] User ${env.sender} lacks permission to edit planes on ${actorId}`);
      return { success: false, actorId, planeId, enabled: false };
    }
    try {
      await toggleActorPlane(actor, planeId, enabled, env.sender);
      emitRefresh({ view: "planar-index", key: actorId, reason: "plane-toggled" }, { includeSelf: true });
      emitRefresh({ view: "planar-index-header", key: actorId, reason: "plane-toggled" }, { includeSelf: true });
      return { success: true, actorId, planeId, enabled };
    } catch (err) {
      console.error(`[planar-index] Failed to toggle plane:`, err);
      return { success: false, actorId, planeId, enabled: false };
    }
  });
  ws.on("pi:planes:get", async (env) => {
    const payload = env.payload;
    const { actorId } = payload;
    const actor = game.actors?.get(actorId);
    if (!actor) {
      console.warn(`[planar-index] Actor ${actorId} not found`);
      return { actorId, planes: {} };
    }
    const planes = getActorPlanes(actor);
    return { actorId, planes };
  });
  ws.on("pi:planes:set", async (env) => {
    requireGmOrThrow();
    const payload = env.payload;
    const { actorId, planes } = payload;
    const actor = game.actors?.get(actorId);
    if (!actor) {
      console.warn(`[planar-index] Actor ${actorId} not found`);
      return { success: false };
    }
    const requestingUser = game.users?.get(env.sender);
    if (requestingUser && !canUserEditPlanes(requestingUser, actor)) {
      console.warn(`[planar-index] User ${env.sender} lacks permission to edit planes on ${actorId}`);
      return { success: false };
    }
    try {
      const { setActorPlanes: setActorPlanes2 } = await Promise.resolve().then(() => (init_plane_flags_service(), plane_flags_service_exports));
      await setActorPlanes2(actor, planes, env.sender);
      emitRefresh({ view: "planar-index", key: actorId, reason: "planes-updated" }, { includeSelf: true });
      emitRefresh({ view: "planar-index-header", key: actorId, reason: "planes-updated" }, { includeSelf: true });
      return { success: true };
    } catch (err) {
      console.error(`[planar-index] Failed to set planes:`, err);
      return { success: false };
    }
  });
  console.log("[planar-index] GM RPC handlers registered");
}

// src/main.ts
var werewolfSocket;
Hooks.on("init", () => {
  werewolfSocket = new WerewolfSocketService(CHANNEL);
  werewolfSocket.init();
  registerHandlebarsHelpers();
  const hb = globalThis.Handlebars;
  if (hb && !hb.helpers?.multiply) {
    hb.registerHelper("multiply", (a, b) => {
      return (Number(a) || 0) * (Number(b) || 0);
    });
  }
  registerSettings();
  const module = getModule();
  if (module) {
    module.api = {
      werewolfSocket
    };
  }
  const validation = validatePlanarLayout();
  if (!validation.valid) {
    console.error("[planar-index] Planar layout validation failed:", validation.errors);
  }
  console.log("Magic Planar Index initialized");
});
Hooks.once("ready", () => {
  registerGmPlanarRpc();
  registerSheetButtonHooks();
  console.log("Magic Planar Index ready");
});
window.addEventListener("beforeunload", () => {
  werewolfSocket?.destroy();
});
//# sourceMappingURL=main.js.map

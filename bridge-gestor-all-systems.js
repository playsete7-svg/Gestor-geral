/**
 * BRIDGE 4: Gestor Geral → Todos os Sistemas
 * =============================================
 * Problema: O gestor le orders, users e motoboys do seu PROPRIO
 *   Firebase (gestor-geral-6ce8d), que ninguem alimenta.
 *   Ele mostra dados fantasmas, nao a realidade.
 *   O bridge existente so conecta com central-de-clientes.
 *
 * Solucao: Adicionar bridges (apps secundarios) para TODOS os
 *   projetos Firebase do ecossistema: loja, central de motoboys
 *   e marketplace. Ler apenas as colecoes necessarias de cada um.
 *
 * INTEGRACAO:
 *   No gestor-geral-enterprise.html, apos a inicializacao do
 *   Firebase principal e do customerBridgeApp existente, adicionar:
 *
 *   <script src="supremo-bridge-config.js"></script>
 *   <script src="bridge-gestor-all-systems.js"></script>
 *
 *   E chamar initGestorBridges() no DOMContentLoaded ou apos
 *   a inicializacao existente.
 */

// Apps secundarios para cada sistema
let storeBridgeDb = null;
let motoboyBridgeDb = null;
let marketplaceBridgeDb = null;
// customerBridgeDb ja existe no gestor-geral-enterprise.html

// Estado dos bridges
const bridgeState = {
  store: { connected: false, error: null },
  motoboy: { connected: false, error: null },
  marketplace: { connected: false, error: null },
};

/**
 * Inicializa todos os bridges do gestor.
 * Cria apps Firebase secundarios para cada sistema e comeca a escutar.
 */
async function initGestorBridges() {
  try {
    const { initializeApp, getFirestore } = await import(
      "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js"
    );
    const firestore = await import(
      "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js"
    );

    // === BRIDGE: LOJA ===
    // Le orders e users da loja para ter dados reais de pedidos
    try {
      const storeApp = initializeApp(SUPREMO_BRIDGE_CONFIG.store, "store-bridge-gestor");
      storeBridgeDb = getFirestore(storeApp);
      bridgeState.store.connected = true;
      console.log("[Bridge4] Bridge da loja conectado:", SUPREMO_BRIDGE_CONFIG.store.projectId);
    } catch (e) {
      bridgeState.store.error = e.message;
      console.warn("[Bridge4] Falha no bridge da loja:", e);
    }

    // === BRIDGE: CENTRAL DE MOTOBOYS ===
    // Le rides e motoboys para supervisionar a logistica real
    try {
      const motoboyApp = initializeApp(SUPREMO_BRIDGE_CONFIG.motoboy, "motoboy-bridge-gestor");
      motoboyBridgeDb = getFirestore(motoboyApp);
      bridgeState.motoboy.connected = true;
      console.log("[Bridge4] Bridge de motoboys conectado:", SUPREMO_BRIDGE_CONFIG.motoboy.projectId);
    } catch (e) {
      bridgeState.motoboy.error = e.message;
      console.warn("[Bridge4] Falha no bridge de motoboys:", e);
    }

    // === BRIDGE: MARKETPLACE ===
    // Le stores e orders do marketplace para supervisionar a vitrine
    try {
      const marketplaceApp = initializeApp(SUPREMO_BRIDGE_CONFIG.marketplace, "marketplace-bridge-gestor");
      marketplaceBridgeDb = getFirestore(marketplaceApp);
      bridgeState.marketplace.connected = true;
      console.log("[Bridge4] Bridge do marketplace conectado:", SUPREMO_BRIDGE_CONFIG.marketplace.projectId);
    } catch (e) {
      bridgeState.marketplace.error = e.message;
      console.warn("[Bridge4] Falha no bridge do marketplace:", e);
    }

    // Iniciar listeners de tempo real
    subscribeBridgeRealtime(firestore);

    return bridgeState;
  } catch (error) {
    console.error("[Bridge4] Falha geral ao inicializar bridges:", error);
    return bridgeState;
  }
}

/**
 * Escuta colecoes em tempo real de cada sistema conectado.
 * @param {Object} firestore - modulo firebase-firestore importado
 */
function subscribeBridgeRealtime(firestore) {
  const { collection, onSnapshot, query, where } = firestore;

  // === Loja: orders (pedidos reais) ===
  if (storeBridgeDb) {
    try {
      onSnapshot(
        collection(storeBridgeDb, "orders"),
        (snap) => {
          const storeOrders = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "store" }));
          window._bridgeStoreOrders = storeOrders;
          window.dispatchEvent(new CustomEvent("gestor:bridge-store-orders", { detail: storeOrders }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.store.error = err.message; console.warn("[Bridge4] Listener loja orders erro:", err); }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escutar orders da loja:", e); }
  }

  // === Central Motoboy: rides + motoboys ===
  if (motoboyBridgeDb) {
    try {
      onSnapshot(
        collection(motoboyBridgeDb, "rides"),
        (snap) => {
          const rides = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeRides = rides;
          window.dispatchEvent(new CustomEvent("gestor:bridge-rides", { detail: rides }));
          updateGestorConsolidated();
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );

      onSnapshot(
        collection(motoboyBridgeDb, "motoboys"),
        (snap) => {
          const couriers = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "motoboy" }));
          window._bridgeCouriers = couriers;
          window.dispatchEvent(new CustomEvent("gestor:bridge-couriers", { detail: couriers }));
        },
        (err) => { bridgeState.motoboy.error = err.message; }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escutar rides/motoboys:", e); }
  }

  // === Marketplace: stores ===
  if (marketplaceBridgeDb) {
    try {
      onSnapshot(
        collection(marketplaceBridgeDb, "stores"),
        (snap) => {
          const stores = snap.docs.map(d => ({ id: d.id, ...d.data(), _source: "marketplace" }));
          window._bridgeMarketplaceStores = stores;
          window.dispatchEvent(new CustomEvent("gestor:bridge-stores", { detail: stores }));
        },
        (err) => { bridgeState.marketplace.error = err.message; }
      );
    } catch (e) { console.warn("[Bridge4] Nao foi possivel escitar stores do marketplace:", e); }
  }
}

/**
 * Consolida dados de todos os bridges em uma visao unificada.
 * Substitui os dados fantasmas que o gestor mostrava do seu proprio Firebase.
 */
function updateGestorConsolidated() {
  const storeOrders = window._bridgeStoreOrders || [];
  const rides = window._bridgeRides || [];
  const couriers = window._bridgeCouriers || [];
  const marketplaceStores = window._bridgeMarketplaceStores || [];
  // customerOrders e customerUsers ja existem do bridge original
  const customerUsers = window._bridgeCustomerUsers || [];

  // Consolidar: para cada pedido da loja, cruzar com a corrida da central
  const consolidated = storeOrders.map(order => {
    const ride = rides.find(r => String(r.orderId) === String(order.id));
    const courier = ride ? couriers.find(c => c.id === ride.selectedCourierId) : null;
    return {
      ...order,
      ride: ride ? { id: ride.id, status: ride.status, courierName: ride.selectedCourierName } : null,
      courier: courier ? { id: courier.id, name: courier.name, status: courier.status } : null,
      _consolidated: true,
    };
  });

  window._gestorConsolidatedOrders = consolidated;

  // Disparar evento para a UI do gestor re-renderizar
  window.dispatchEvent(new CustomEvent("gestor:consolidated-update", {
    detail: {
      orders: consolidated,
      rides,
      couriers,
      stores: marketplaceStores,
      customers: customerUsers,
      bridgeStatus: bridgeState,
    }
  }));
}

/**
 * Retorna o status de todos os bridges para exibir no painel do gestor.
 */
function getBridgeStatus() {
  return {
    store: bridgeState.store,
    motoboy: bridgeState.motoboy,
    marketplace: bridgeState.marketplace,
    customers: { connected: true, error: null }, // ja existe no gestor
  };
}

/**
 * Helper para o gestor publicar comandos em qualquer sistema.
 * Ex: forcar cancelamento de uma corrida, suspender motoboy, etc.
 */
async function gestorPublishCommand(system, command, payload) {
  return await supremoPublishEvent(system, "command", "warning", `Comando do gestor: ${command}`, payload?.entityId, payload);
}

if (typeof window !== "undefined") {
  window.initGestorBridges = initGestorBridges;
  window.getBridgeStatus = getBridgeStatus;
  window.gestorPublishCommand = gestorPublishCommand;
  window.updateGestorConsolidated = updateGestorConsolidated;
}

import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

function stateIndicatesOffline(state: NetInfoState): boolean {
  if (state.isConnected === false) return true;
  if (state.isInternetReachable === false) return true;
  return false;
}

/** Последнее известное состояние (обновляется подпиской и fetch). */
let lastOffline = false;

export function getOfflineSnapshot(): boolean {
  return lastOffline;
}

export function subscribeConnectivity(): () => void {
  return NetInfo.addEventListener((state) => {
    lastOffline = stateIndicatesOffline(state);
  });
}

export async function initConnectivityOnce(): Promise<void> {
  const s = await NetInfo.fetch();
  lastOffline = stateIndicatesOffline(s);
}

export async function fetchIsOffline(): Promise<boolean> {
  const s = await NetInfo.fetch();
  lastOffline = stateIndicatesOffline(s);
  return lastOffline;
}

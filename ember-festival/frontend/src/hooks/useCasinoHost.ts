import { useEffect, useState } from 'react';
import {
  connectGameToHost,
  type GuestBridgeConnection,
  type HostApiV1,
  type HostSnapshotV1,
  observeGameContentSize,
} from '@chain/casino-sdk/guest';

type SnapshotListener = (snapshot: HostSnapshotV1 | null) => void;

type HostBridge = {
  connection: GuestBridgeConnection;
  listeners: Set<SnapshotListener>;
  latest: HostSnapshotV1 | null;
  parentApi: HostApiV1 | null;
};

let bridge: HostBridge | undefined;

function hostBridge(): HostBridge {
  if (bridge) return bridge;
  const listeners = new Set<SnapshotListener>();
  const created: HostBridge = {
    listeners,
    latest: null,
    parentApi: null,
    connection: connectGameToHost({
      async setState(snapshot) {
        created.latest = snapshot;
        listeners.forEach(listener => listener(snapshot));
      },
    }),
  };

  void created.connection.promise
    .then(parent => {
      created.parentApi = parent;
    })
    .catch(() => {});

  bridge = created;
  return created;
}

export function useCasinoHost() {
  const isTopLevel = typeof window !== 'undefined' && window.self === window.top;
  const currentBridge = isTopLevel ? undefined : hostBridge();

  const [hostApi, setHostApi] = useState<HostApiV1 | null>(() => currentBridge?.parentApi ?? null);
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(() => currentBridge?.latest ?? null);
  const [connectionTimedOut, setConnectionTimedOut] = useState(isTopLevel);

  useEffect(function subscribeToHost() {
    if (isTopLevel) {
      setConnectionTimedOut(true);
      return;
    }

    const b = hostBridge();
    let mounted = true;
    b.listeners.add(setSnapshot);
    if (b.latest) setSnapshot(b.latest);
    if (b.parentApi) setHostApi(b.parentApi);

    // If host hasn't connected after 3.5s in iframe, trigger fallback
    const timer = setTimeout(() => {
      if (mounted && !b.parentApi) {
        setConnectionTimedOut(true);
      }
    }, 3500);

    void b.connection.promise
      .then(parent => {
        clearTimeout(timer);
        b.parentApi = parent;
        if (mounted) {
          setHostApi(parent);
          setConnectionTimedOut(false);
        }
      })
      .catch(() => {
        clearTimeout(timer);
        if (mounted) setConnectionTimedOut(true);
      });

    return function unsubscribeFromHost() {
      mounted = false;
      clearTimeout(timer);
      b.listeners.delete(setSnapshot);
    };
  }, [isTopLevel]);

  // Case 4 — Iframe resize reporting
  useEffect(
    function reportContentSize() {
      if (!hostApi) return;
      const observer = observeGameContentSize(hostApi);
      return () => observer.disconnect();
    },
    [hostApi],
  );

  return { hostApi, snapshot, connectionTimedOut };
}

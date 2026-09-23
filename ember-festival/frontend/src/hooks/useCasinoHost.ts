import { useEffect, useState } from 'react';
import {
  connectGameToHost,
  type GuestBridgeConnection,
  type HostApiV1,
  type HostSnapshotV1,
  observeGameContentSize,
} from '@chain/casino-sdk/guest';
import { createDemoHost } from '../lib/demoHost.ts';

type SnapshotListener = (snapshot: HostSnapshotV1 | null) => void;

type HostBridge = {
  connection?: GuestBridgeConnection;
  hostApi?: HostApiV1;
  listeners: Set<SnapshotListener>;
  latest: HostSnapshotV1 | null;
  isStandalone: boolean;
};

let bridge: HostBridge | undefined;

function getHostBridge(): HostBridge {
  if (bridge) return bridge;

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.self === window.top ||
      new URLSearchParams(window.location.search).has('demo'));

  const listeners = new Set<SnapshotListener>();

  if (isStandalone) {
    const demo = createDemoHost(snap => {
      if (bridge) {
        bridge.latest = snap;
        bridge.listeners.forEach(l => l(snap));
      }
    });

    bridge = {
      hostApi: demo.hostApi,
      listeners,
      latest: demo.getSnapshot(),
      isStandalone: true,
    };
    return bridge;
  }

  // Running inside an iframe — connect to the host SDK
  const created: HostBridge = {
    listeners,
    latest: null,
    isStandalone: false,
    connection: connectGameToHost({
      async setState(snapshot) {
        created.latest = snapshot;
        listeners.forEach(listener => listener(snapshot));
      },
    }),
  };
  bridge = created;
  return created;
}

export function useCasinoHost() {
  const currentBridge = getHostBridge();
  const [hostApi, setHostApi] = useState<HostApiV1 | null>(
    currentBridge.hostApi ?? null,
  );
  const [snapshot, setSnapshot] = useState<HostSnapshotV1 | null>(
    currentBridge.latest,
  );
  const [isStandalone, setIsStandalone] = useState(currentBridge.isStandalone);

  useEffect(function subscribeToHost() {
    const b = getHostBridge();
    let mounted = true;
    b.listeners.add(setSnapshot);
    setSnapshot(b.latest);

    if (b.hostApi) {
      setHostApi(b.hostApi);
      setIsStandalone(b.isStandalone);
      return () => {
        mounted = false;
        b.listeners.delete(setSnapshot);
      };
    }

    if (b.connection) {
      // Fallback timer: if running in an unconnected iframe, don't stall indefinitely
      const fallbackTimer = setTimeout(() => {
        if (mounted && !b.hostApi) {
          const demo = createDemoHost(snap => {
            b.latest = snap;
            b.listeners.forEach(l => l(snap));
          });
          b.hostApi = demo.hostApi;
          b.latest = demo.getSnapshot();
          b.isStandalone = true;
          setHostApi(demo.hostApi);
          setSnapshot(demo.getSnapshot());
          setIsStandalone(true);
        }
      }, 3500);

      void b.connection.promise
        .then(parent => {
          clearTimeout(fallbackTimer);
          if (mounted) {
            b.hostApi = parent;
            setHostApi(parent);
            setIsStandalone(false);
          }
        })
        .catch(() => {
          clearTimeout(fallbackTimer);
          if (mounted) {
            const demo = createDemoHost(snap => {
              b.latest = snap;
              b.listeners.forEach(l => l(snap));
            });
            b.hostApi = demo.hostApi;
            b.latest = demo.getSnapshot();
            b.isStandalone = true;
            setHostApi(demo.hostApi);
            setSnapshot(demo.getSnapshot());
            setIsStandalone(true);
          }
        });

      return function unsubscribeFromHost() {
        mounted = false;
        clearTimeout(fallbackTimer);
        b.listeners.delete(setSnapshot);
      };
    }

    return function unsubscribeFromHost() {
      mounted = false;
      b.listeners.delete(setSnapshot);
    };
  }, []);

  // Case 4 — Iframe resize reporting
  useEffect(
    function reportContentSize() {
      if (!hostApi || isStandalone) return;
      const observer = observeGameContentSize(hostApi);
      return () => observer.disconnect();
    },
    [hostApi, isStandalone],
  );

  return { hostApi, snapshot, isStandalone };
}

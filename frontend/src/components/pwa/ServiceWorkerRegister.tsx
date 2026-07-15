"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // re-check for a new SW every 5 minutes

export default function ServiceWorkerRegister() {
  const [updateReady, setUpdateReady] = useState(false);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const reloadingRef = useRef(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const promoteWaitingWorker = (worker: ServiceWorker) => {
      waitingWorkerRef.current = worker;
      setUpdateReady(true);
    };

    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        // An update may already be sitting in "waiting" (e.g. tab was open during deploy)
        if (registration.waiting && navigator.serviceWorker.controller) {
          promoteWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promoteWaitingWorker(newWorker);
            }
          });
        });

        const interval = setInterval(() => {
          registration.update().catch(() => {});
        }, UPDATE_CHECK_INTERVAL_MS);
        return () => clearInterval(interval);
      })
      .catch((error) => {
        console.log("SW registration failed:", error);
      });

    const onControllerChange = () => {
      if (reloadingRef.current) return;
      reloadingRef.current = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  const handleReload = () => {
    waitingWorkerRef.current?.postMessage("SKIP_WAITING");
  };

  if (!updateReady) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-100 flex justify-center px-4 pt-3">
      <div className="flex items-center gap-3 rounded-xl bg-primary px-4 py-2.5 text-primary-foreground shadow-lg">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">Versi baru aplikasi tersedia</span>
        <button
          onClick={handleReload}
          className="rounded-lg bg-white/15 px-3 py-1 text-sm font-semibold hover:bg-white/25 transition-colors"
        >
          Muat Ulang
        </button>
      </div>
    </div>
  );
}

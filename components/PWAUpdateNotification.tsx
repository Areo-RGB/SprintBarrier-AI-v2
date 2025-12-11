import React, { useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

export const PWAUpdateNotification: React.FC = () => {
  const [showNotification, setShowNotification] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log("SW Registered: " + r);
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log("SW registration error", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      setShowNotification(true);
    }
  }, [needRefresh]);

  const handleUpdate = () => {
    updateServiceWorker(true);
    setShowNotification(false);
  };

  const handleDismiss = () => {
    setShowNotification(false);
    setNeedRefresh(false);
  };

  if (!showNotification) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-xl shadow-2xl shadow-blue-900/50 border border-blue-400/30 p-3">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-5 h-5 text-white"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-xs mb-0.5">
              Update Available
            </h3>
            <p className="text-white/80 text-[10px] mb-2">
              New version ready. Update for latest features.
            </p>

            <div className="flex gap-1.5">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-white hover:bg-blue-50 text-blue-700 font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all transform active:scale-95"
              >
                Update
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg transition-all"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {offlineReady && (
        <div className="mt-2 bg-gray-950/95 backdrop-blur-md rounded-lg border border-blue-800/40 p-2 text-center">
          <p className="text-[10px] text-blue-300 font-mono">
            <span className="inline-block w-1.5 h-1.5 bg-cyan-400 rounded-full mr-1.5 animate-pulse"></span>
            App ready for offline use
          </p>
        </div>
      )}
    </div>
  );
};

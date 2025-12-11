import React, { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

export const PWAUpdateNotification: React.FC = () => {
  const [showNotification, setShowNotification] = useState(false);

  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
      // Check for updates every hour
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
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
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div className="bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl shadow-2xl border border-emerald-400/50 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-white"
            >
              <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm mb-1">
              Update Available
            </h3>
            <p className="text-white/90 text-xs mb-3">
              A new version of SprintBarrier AI is ready. Update now for the latest features and improvements.
            </p>

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                className="flex-1 bg-white hover:bg-gray-100 text-emerald-700 font-bold text-xs py-2 px-4 rounded-lg transition-all transform active:scale-95"
              >
                Update Now
              </button>
              <button
                onClick={handleDismiss}
                className="flex-1 bg-white/20 hover:bg-white/30 text-white font-bold text-xs py-2 px-4 rounded-lg transition-all"
              >
                Later
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>

      {offlineReady && (
        <div className="mt-2 bg-gray-900/90 backdrop-blur-md rounded-lg border border-gray-700 p-2 text-center">
          <p className="text-xs text-gray-300">
            <span className="inline-block w-2 h-2 bg-emerald-500 rounded-full mr-1.5"></span>
            App is ready to work offline
          </p>
        </div>
      )}
    </div>
  );
};

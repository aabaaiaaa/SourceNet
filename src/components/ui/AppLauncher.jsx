import { useRef } from 'react';
import { MULTI_INSTANCE_APPS, SOFTWARE_CATALOG } from '../../constants/gameConstants';
import { calculateStorageUsed, calculateLocalFilesSize, formatStorage } from '../../systems/StorageSystem';
import { getTotalRamMB, getUsedRamMB, formatRam } from '../../systems/RamSystem';

const AppLauncher = ({
  showAppLauncher,
  setShowAppLauncher,
  apps,
  software,
  hardware,
  windows,
  localSSDFiles,
  activePassiveSoftware,
  startPassiveSoftware,
  stopPassiveSoftware,
  openWindow,
}) => {
  const appLauncherTimeout = useRef(null);

  return (
    <div className="topbar-section">
      <div
        className="topbar-button-wrapper"
        onMouseEnter={() => {
          if (appLauncherTimeout.current) {
            clearTimeout(appLauncherTimeout.current);
          }
          setShowAppLauncher(true);
        }}
        onMouseLeave={() => {
          appLauncherTimeout.current = setTimeout(() => {
            setShowAppLauncher(false);
          }, 100);
        }}
      >
        <button className="topbar-button">☰</button>
        {showAppLauncher && (
          <div
            className="dropdown-menu app-launcher-menu"
            onMouseEnter={() => {
              if (appLauncherTimeout.current) {
                clearTimeout(appLauncherTimeout.current);
              }
            }}
            onMouseLeave={() => {
              appLauncherTimeout.current = setTimeout(() => {
                setShowAppLauncher(false);
              }, 100);
            }}
          >
            {apps.map((app) => {
              const catalogEntry = SOFTWARE_CATALOG.find(s => s.id === app.softwareId);
              const isPassive = catalogEntry?.passive === true;
              const isPassiveRunning = isPassive && activePassiveSoftware?.includes(app.softwareId);

              return (
                <button
                  key={app.appId}
                  onClick={() => {
                    if (isPassive) {
                      if (isPassiveRunning && stopPassiveSoftware) {
                        stopPassiveSoftware(app.softwareId);
                      } else if (!isPassiveRunning && startPassiveSoftware) {
                        startPassiveSoftware(app.softwareId);
                      }
                    } else {
                      openWindow(app.appId);
                    }
                    setShowAppLauncher(false);
                  }}
                  className={MULTI_INSTANCE_APPS.includes(app.appId) ? 'multi-instance-app' : ''}
                  title={isPassive
                    ? (isPassiveRunning ? `${app.title} (running - click to stop)` : `${app.title} (click to start)`)
                    : (MULTI_INSTANCE_APPS.includes(app.appId) ? `${app.title} (can open multiple)` : app.title)}
                >
                  {app.title}
                  {MULTI_INSTANCE_APPS.includes(app.appId) && <span className="multi-instance-badge">⊞</span>}
                  {isPassive && (
                    <span className={`passive-status ${isPassiveRunning ? 'on' : 'off'}`}>
                      {isPassiveRunning ? 'ON' : 'OFF'}
                    </span>
                  )}
                </button>
              );
            })}
            <div className="app-launcher-storage">
              {formatStorage(calculateStorageUsed(software || []), calculateLocalFilesSize(localSSDFiles || []), 90)}
            </div>
            <div className="app-launcher-storage">
              RAM: {formatRam(getUsedRamMB(windows, activePassiveSoftware), getTotalRamMB(hardware))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AppLauncher;

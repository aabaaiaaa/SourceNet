import { useRef } from 'react';

const PowerMenu = ({
  showPowerMenu,
  setShowPowerMenu,
  isPaused,
  setIsPaused,
  activeConnections,
  ransomwareThreat,
  onSave,
  onLoad,
  onReboot,
  onSleep,
}) => {
  const powerMenuTimeout = useRef(null);

  return (
    <div className="topbar-section">
      <div
        className="topbar-button-wrapper"
        onMouseEnter={() => {
          if (powerMenuTimeout.current) {
            clearTimeout(powerMenuTimeout.current);
          }
          setShowPowerMenu(true);
        }}
        onMouseLeave={() => {
          powerMenuTimeout.current = setTimeout(() => {
            setShowPowerMenu(false);
          }, 100);
        }}
      >
        <button className="topbar-button">⏻</button>
        {showPowerMenu && (
          <div
            className="dropdown-menu power-menu"
            onMouseEnter={() => {
              if (powerMenuTimeout.current) {
                clearTimeout(powerMenuTimeout.current);
              }
            }}
            onMouseLeave={() => {
              powerMenuTimeout.current = setTimeout(() => {
                setShowPowerMenu(false);
              }, 100);
            }}
          >
            {!isPaused ? (
              <button onClick={() => setIsPaused(true)}>Pause</button>
            ) : (
              <button onClick={() => setIsPaused(false)}>Resume</button>
            )}
            <button
              onClick={onSave}
              disabled={activeConnections?.length > 0 || ransomwareThreat}
              title={ransomwareThreat ? 'Cannot save during ransomware attack' : activeConnections?.length > 0 ? 'Disconnect from all networks to save your game' : undefined}
            >Save</button>
            <button onClick={onLoad}>Load</button>
            <button
              onClick={onReboot}
              disabled={ransomwareThreat}
              title={ransomwareThreat ? 'Cannot reboot during ransomware attack' : undefined}
            >Reboot</button>
            <button
              onClick={onSleep}
              disabled={ransomwareThreat}
              title={ransomwareThreat ? 'Cannot sleep during ransomware attack' : undefined}
            >Sleep</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PowerMenu;

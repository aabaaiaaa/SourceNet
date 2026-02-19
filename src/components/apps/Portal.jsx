import { useState } from 'react';
import { useGame } from '../../contexts/useGame';
import { HARDWARE_CATALOG, SOFTWARE_CATALOG, SERVICES_CATALOG } from '../../constants/gameConstants';
import { isHardwareInstalled } from '../../utils/helpers';
import { createDownloadItem } from '../../systems/useDownloadManager';
import { isHardwareCategoryUnlocked, isSoftwareUnlocked, getUnlockHint } from '../../systems/UnlockSystem';
import {
  queueHardwareInstall,
  isItemPending,
  getSlotUsage,
  getEffectiveMotherboard,
  canPurchaseHardware,
  getMotherboardDowngradeWarning,
  getProjectedPowerState,
} from '../../systems/HardwareInstallationSystem';
import { getTotalStorageCapacityGB } from '../../systems/StorageSystem';
import './Portal.css';

const Portal = () => {
  const {
    hardware,
    software,
    bankAccounts,
    updateBankBalance,
    setTransactions,
    currentTime,
    getTotalCredits,
    setDownloadQueue,
    downloadQueue,
    licensedSoftware,
    unlockedFeatures,
    pendingHardwareUpgrades,
    setPendingHardwareUpgrades,
    spareHardware,
    setSpareHardware,
    purchasedServices,
    setPurchasedServices,
  } = useGame();
  const [activeCategory, setActiveCategory] = useState('processors');
  const [activeSection, setActiveSection] = useState('software');
  const [activeHardwareTab, setActiveHardwareTab] = useState('shop'); // 'shop' or 'spares'
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseType, setPurchaseType] = useState('software'); // 'software' or 'hardware'
  const [purchaseWarning, setPurchaseWarning] = useState(null);
  const [hwConfigExpanded, setHwConfigExpanded] = useState(false);

  const handlePurchaseClick = (item, type = 'software') => {
    setSelectedItem(item);
    setPurchaseType(type);

    // Check for motherboard downgrade warning
    let warning = null;
    if (type === 'hardware' && activeCategory === 'motherboards') {
      warning = getMotherboardDowngradeWarning(hardware, pendingHardwareUpgrades, item);
    }
    setPurchaseWarning(warning);
    setShowPurchaseModal(true);
  };

  const handleConfirmPurchase = () => {
    if (!selectedItem) return;

    const price = selectedItem.price;
    const primaryAccountId = bankAccounts[0]?.id;

    if (primaryAccountId) {
      // Deduct credits using helper (emits creditsChanged event, overdraft is allowed)
      const newBalance = bankAccounts[0].balance - price;
      const purchaseDescription = purchaseType === 'hardware'
        ? `Hardware Purchase: ${selectedItem.name}`
        : purchaseType === 'service'
          ? `Service Purchase: ${selectedItem.name}`
          : `Software Purchase: ${selectedItem.name}`;

      updateBankBalance(primaryAccountId, -price, `${purchaseType}-purchase`);

      // Add transaction
      setTransactions(prev => [...prev, {
        id: `txn-purchase-${Date.now()}`,
        date: currentTime.toISOString(),
        type: 'expense',
        amount: -price,
        description: purchaseDescription,
        balanceAfter: newBalance,
      }]);

      if (purchaseType === 'hardware') {
        // Queue hardware for installation on next reboot
        const newPending = queueHardwareInstall(pendingHardwareUpgrades, activeCategory, selectedItem);
        setPendingHardwareUpgrades(newPending);
        console.log(`🔧 Hardware "${selectedItem.name}" queued for installation - reboot required`);
      } else if (purchaseType === 'service') {
        // Add service to purchased services
        setPurchasedServices(prev => {
          if (selectedItem.oneTimePurchase && prev.includes(selectedItem.id)) return prev;
          return [...prev, selectedItem.id];
        });
        console.log(`🔗 Service "${selectedItem.name}" purchased`);
      } else {
        // Add to download queue - the download manager hook handles progress and completion
        const downloadItem = createDownloadItem(
          selectedItem.id,
          selectedItem.name,
          selectedItem.sizeInMB || 50, // Use actual size from catalog
          currentTime
        );
        setDownloadQueue(prev => [...prev, downloadItem]);
      }
    }

    setShowPurchaseModal(false);
    setSelectedItem(null);
    setPurchaseWarning(null);
  };

  const handleInstallLicensed = (item) => {
    // Install licensed software without payment
    const downloadItem = createDownloadItem(
      item.id,
      item.name,
      item.sizeInMB || 50,
      currentTime
    );
    setDownloadQueue(prev => {
      const newQueue = [...prev, downloadItem];
      return newQueue;
    });
  };

  const handleServicePurchase = (service) => {
    setSelectedItem(service);
    setPurchaseType('service');
    setPurchaseWarning(null);
    setShowPurchaseModal(true);
  };

  const handleReinstallSpare = (item, index) => {
    // Queue spare item for next reboot
    // Determine the category from the item properties
    let category;
    if (item.specs && item.id?.startsWith('cpu')) category = 'processors';
    else if (item.capacity && item.id?.startsWith('ram')) category = 'memory';
    else if (item.capacity && item.id?.startsWith('ssd')) category = 'storage';
    else if (item.cpuSlots !== undefined) category = 'motherboards';
    else if (item.wattage !== undefined) category = 'powerSupplies';
    else if (item.speed !== undefined) category = 'network';
    else return;

    const newPending = queueHardwareInstall(pendingHardwareUpgrades, category, item);
    setPendingHardwareUpgrades(newPending);

    // Remove from spares
    setSpareHardware(prev => prev.filter((_, i) => i !== index));
    console.log(`🔧 Spare "${item.name}" queued for re-installation`);
  };

  const handleSellSpare = (item, index) => {
    const sellPrice = Math.floor(item.price * 0.5);
    const primaryAccountId = bankAccounts[0]?.id;

    if (primaryAccountId) {
      updateBankBalance(primaryAccountId, sellPrice, 'hardware-sale');
      setTransactions(prev => [...prev, {
        id: `txn-sell-${Date.now()}`,
        date: currentTime.toISOString(),
        type: 'income',
        amount: sellPrice,
        description: `Hardware Sale: ${item.name}`,
        balanceAfter: bankAccounts[0].balance + sellPrice,
      }]);
    }

    // Remove from spares
    setSpareHardware(prev => prev.filter((_, i) => i !== index));
    console.log(`💰 Sold spare "${item.name}" for $${sellPrice}`);
  };

  const hardwareCategories = [
    { id: 'processors', name: 'Processors', items: HARDWARE_CATALOG.processors },
    { id: 'memory', name: 'Memory', items: HARDWARE_CATALOG.memory },
    { id: 'storage', name: 'Storage', items: HARDWARE_CATALOG.storage },
    { id: 'motherboards', name: 'Motherboards', items: HARDWARE_CATALOG.motherboards },
    { id: 'powerSupplies', name: 'Power Supplies', items: HARDWARE_CATALOG.powerSupplies },
    { id: 'network', name: 'Network Adapters', items: HARDWARE_CATALOG.network },
  ];

  const currentCategory = hardwareCategories.find((c) => c.id === activeCategory);
  const currentItems = activeSection === 'hardware' ? currentCategory?.items || [] : SOFTWARE_CATALOG;

  // Hardware configuration display data
  const slots = getSlotUsage(hardware, pendingHardwareUpgrades);
  const effectiveMb = getEffectiveMotherboard(hardware, pendingHardwareUpgrades);
  const powerState = getProjectedPowerState(hardware, pendingHardwareUpgrades);
  const totalStorageGB = getTotalStorageCapacityGB(hardware);

  const hasPendingItems = pendingHardwareUpgrades && Object.keys(pendingHardwareUpgrades).length > 0;

  const renderHardwareConfigSummary = () => {
    const cpuName = (pendingHardwareUpgrades?.cpu || hardware.cpu)?.name || '?';
    const memCount = (hardware.memory?.length || 0) + (pendingHardwareUpgrades?.memory?.length || 0);
    const memTotal = effectiveMb?.memorySlots || 2;
    const storCount = (hardware.storage?.length || 0) + (pendingHardwareUpgrades?.storage?.length || 0);
    const storTotal = effectiveMb?.storageSlots || 2;

    return (
      <span className="hw-config-summary">
        {cpuName} | Mem {memCount}/{memTotal} | Stor {storCount}/{storTotal} | {totalStorageGB}GB | {powerState.consumption}W/{powerState.capacity}W
        {hasPendingItems && <span className="hw-pending"> (pending)</span>}
      </span>
    );
  };

  const renderHardwareConfig = () => {
    const pendingCpu = pendingHardwareUpgrades?.cpu;
    const pendingNetwork = pendingHardwareUpgrades?.network;
    const pendingMb = pendingHardwareUpgrades?.motherboard;
    const pendingMemory = pendingHardwareUpgrades?.memory || [];
    const pendingStorage = pendingHardwareUpgrades?.storage || [];

    const renderItem = (item, isPending = false) => (
      <span className={isPending ? 'hw-pending' : 'hw-installed'}>
        {isPending && '\u27F3 '}{item.name}{isPending ? ' (pending)' : ''}
      </span>
    );

    const renderSlotItems = (installed, pending, totalSlots) => {
      const items = [];
      installed.forEach((item, i) => items.push(<span key={`inst-${i}`} className="hw-slot hw-installed">[{item.name}]</span>));
      pending.forEach((item, i) => items.push(<span key={`pend-${i}`} className="hw-slot hw-pending">[{'\u27F3 '}{item.name}]</span>));
      const emptyCount = Math.max(0, totalSlots - installed.length - pending.length);
      for (let i = 0; i < emptyCount; i++) {
        items.push(<span key={`empty-${i}`} className="hw-slot hw-empty">[Empty]</span>);
      }
      return items;
    };

    return (
      <div className="hardware-config" data-testid="hardware-config">
        <div
          className="hw-config-header"
          onClick={() => setHwConfigExpanded(!hwConfigExpanded)}
          data-testid="hw-config-toggle"
        >
          <span className="hw-config-title">
            <span className="hw-config-chevron">{hwConfigExpanded ? '\u25BC' : '\u25B6'}</span>
            Hardware Configuration
          </span>
          {!hwConfigExpanded && renderHardwareConfigSummary()}
        </div>
        {hwConfigExpanded && (
          <div className="hw-config-details" data-testid="hw-config-details">
            <div className="hw-config-row">
              <span className="hw-config-label">CPU ({slots.cpu.used}/{slots.cpu.total}):</span>
              {pendingCpu ? renderItem(pendingCpu, true) : renderItem(hardware.cpu)}
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Memory ({slots.memory.used}/{slots.memory.total}):</span>
              <span className="hw-slot-list">
                {renderSlotItems(hardware.memory, pendingMemory, effectiveMb.memorySlots)}
              </span>
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Storage ({slots.storage.used}/{slots.storage.total}):</span>
              <span className="hw-slot-list">
                {renderSlotItems(hardware.storage, pendingStorage, effectiveMb.storageSlots)}
              </span>
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Network ({slots.network.used}/{slots.network.total}):</span>
              {pendingNetwork ? renderItem(pendingNetwork, true) : renderItem(hardware.network)}
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Motherboard:</span>
              {pendingMb ? renderItem(pendingMb, true) : renderItem(hardware.motherboard)}
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Power:</span>
              <span className={`hw-power ${!powerState.canPower ? 'hw-power-over' : ''}`}>
                {powerState.consumption}W / {powerState.capacity}W ({powerState.headroom}W available)
              </span>
            </div>
            <div className="hw-config-row">
              <span className="hw-config-label">Storage Capacity:</span>
              <span>{totalStorageGB} GB</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSpareHardware = () => {
    if (!spareHardware || spareHardware.length === 0) {
      return <div className="empty-state">No spare hardware available</div>;
    }

    return (
      <div className="portal-items">
        {spareHardware.map((item, index) => (
          <div key={`spare-${index}`} className="portal-item spare-item" data-testid="spare-item">
            <div className="item-header">
              <div className="item-name">{item.name}</div>
              <div className="item-price">Sell: ${Math.floor(item.price * 0.5)}</div>
            </div>
            <div className="item-specs">
              {item.specs && <div>Specs: {item.specs}</div>}
              {item.capacity && <div>Capacity: {item.capacity}</div>}
              {item.speed && <div>Speed: {item.speed} Mbps</div>}
              {item.wattage && <div>Wattage: {item.wattage}W</div>}
              {item.power && <div>Power: {item.power}W</div>}
            </div>
            <div className="item-status">
              <button
                className="reinstall-btn"
                onClick={() => handleReinstallSpare(item, index)}
                data-testid="reinstall-spare"
              >
                Re-install
              </button>
              <button
                className="sell-btn"
                onClick={() => handleSellSpare(item, index)}
                data-testid="sell-spare"
              >
                Sell (${Math.floor(item.price * 0.5)})
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="portal">
      <div className="portal-header">
        <h2>OSNet Software/Hardware Portal</h2>
        <p className="portal-subtitle">Browse available upgrades</p>
      </div>

      <div className="portal-sections">
        <button
          className={`section-btn ${activeSection === 'hardware' ? 'active' : ''}`}
          onClick={() => setActiveSection('hardware')}
        >
          Hardware
        </button>
        <button
          className={`section-btn ${activeSection === 'software' ? 'active' : ''}`}
          onClick={() => setActiveSection('software')}
        >
          Software
        </button>
        <button
          className={`section-btn ${activeSection === 'services' ? 'active' : ''}`}
          onClick={() => setActiveSection('services')}
        >
          Services
        </button>
      </div>

      {activeSection === 'hardware' && (
        <>
          {renderHardwareConfig()}

          <div className="hardware-tabs">
            <button
              className={`hw-tab-btn ${activeHardwareTab === 'shop' ? 'active' : ''}`}
              onClick={() => setActiveHardwareTab('shop')}
            >
              Shop
            </button>
            <button
              className={`hw-tab-btn ${activeHardwareTab === 'spares' ? 'active' : ''}`}
              onClick={() => setActiveHardwareTab('spares')}
              data-testid="spares-tab"
            >
              Spares ({spareHardware?.length || 0})
            </button>
          </div>

          {activeHardwareTab === 'shop' && (
            <div className="portal-categories">
              {hardwareCategories.map((cat) => (
                <button
                  key={cat.id}
                  className={`category-btn ${activeCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {activeSection === 'services' && (
        <div className="portal-items">
          {SERVICES_CATALOG.length === 0 ? (
            <div className="empty-state">No services available</div>
          ) : (
            SERVICES_CATALOG.map((service) => {
              const isLocked = !isSoftwareUnlocked(unlockedFeatures, service);
              const lockHint = isLocked ? getUnlockHint(service.requiresUnlock) : null;
              const isPurchased = service.oneTimePurchase && purchasedServices.includes(service.id);
              const requiresPrereq = service.requiresService && !purchasedServices.includes(service.requiresService);
              const purchaseCount = purchasedServices.filter(id => id === service.id).length;

              return (
                <div
                  key={service.id}
                  className={`portal-item ${isPurchased ? 'installed' : ''} ${isLocked ? 'locked' : ''}`}
                >
                  <div className="item-header">
                    <div className="item-name">
                      {isLocked && <span className="lock-icon">🔒 </span>}
                      {service.name}
                    </div>
                    <div className="item-price">${service.price}</div>
                  </div>
                  <div className="item-specs">
                    <div>{service.description}</div>
                    {!service.oneTimePurchase && purchaseCount > 0 && (
                      <div>Purchased: {purchaseCount} time{purchaseCount !== 1 ? 's' : ''}</div>
                    )}
                  </div>
                  <div className="item-status">
                    {isPurchased && <span className="status-badge installed-badge">✓ Active</span>}
                    {isLocked && !isPurchased && (
                      <span className="status-badge locked-badge" title={lockHint}>
                        🔒 Locked
                      </span>
                    )}
                    {!isLocked && !isPurchased && !requiresPrereq && (
                      <button
                        className="purchase-btn"
                        onClick={() => handleServicePurchase(service)}
                      >
                        Purchase
                      </button>
                    )}
                    {!isLocked && !isPurchased && requiresPrereq && (
                      <span className="status-badge unavailable-badge">Requires {SERVICES_CATALOG.find(s => s.id === service.requiresService)?.name || 'prerequisite'}</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {activeSection === 'hardware' && activeHardwareTab === 'spares' ? (
        renderSpareHardware()
      ) : activeSection !== 'services' ? (
        <div className="portal-items">
          {currentItems.length === 0 ? (
            <div className="empty-state">No items in this category</div>
          ) : (
            currentItems.map((item) => {
              const hardwareInstalled = activeSection === 'hardware' && isHardwareInstalled(item, hardware);
              const softwareInstalled = activeSection === 'software' && software && software.includes(item.id);
              const installed = hardwareInstalled || softwareInstalled;
              const isLicensed = activeSection === 'software' && licensedSoftware && licensedSoftware.includes(item.id);
              const available = activeSection === 'software' ? item.available : true;
              const isInQueue = downloadQueue && downloadQueue.some(d => d.softwareId === item.id);

              // Check unlock status for hardware categories and software
              const isHardwareLocked = activeSection === 'hardware' && !isHardwareCategoryUnlocked(unlockedFeatures, activeCategory);
              const isSoftwareLocked = activeSection === 'software' && !isSoftwareUnlocked(unlockedFeatures, item) && !isLicensed;
              const isLocked = isHardwareLocked || isSoftwareLocked;
              const lockHint = isLocked ? getUnlockHint(activeSection === 'hardware' ? activeCategory : item.requiresUnlock) : null;

              // Check if this specific hardware item is pending reboot
              const isPendingReboot = activeSection === 'hardware' &&
                pendingHardwareUpgrades &&
                isItemPending(pendingHardwareUpgrades, activeCategory, item.id);

              // Check purchase validation for hardware
              let purchaseCheck = { allowed: true, reason: null };
              if (activeSection === 'hardware' && !installed && !isLocked && !isPendingReboot) {
                purchaseCheck = canPurchaseHardware(hardware, pendingHardwareUpgrades, activeCategory, item);
              }

              return (
                <div
                  key={item.id}
                  className={`portal-item ${installed ? 'installed' : ''} ${!available ? 'unavailable' : ''} ${isLocked ? 'locked' : ''} ${isPendingReboot ? 'pending-reboot' : ''}`}
                >
                  <div className="item-header">
                    <div className="item-name">
                      {isLocked && <span className="lock-icon">🔒 </span>}
                      {item.name}
                    </div>
                    <div className="item-price">${item.price}</div>
                  </div>
                  <div className="item-specs">
                    {item.specs && <div>Specs: {item.specs}</div>}
                    {item.capacity && <div>Capacity: {item.capacity}</div>}
                    {item.speed && <div>Speed: {item.speed} Mbps</div>}
                    {item.wattage && <div>Wattage: {item.wattage}W</div>}
                    {item.cpuSlots && (
                      <div>
                        Slots: {item.cpuSlots} CPU, {item.memorySlots} Memory,{' '}
                        {item.storageSlots} Storage, {item.networkSlots} Network
                      </div>
                    )}
                    {item.power && <div>Power: {item.power}W</div>}
                    {item.description && <div>{item.description}</div>}
                  </div>
                  <div className="item-status">
                    {installed && <span className="status-badge installed-badge">✓ Installed</span>}
                    {isPendingReboot && <span className="status-badge pending-badge" title="Reboot to install">⟳ Pending Reboot</span>}
                    {!available && <span className="status-badge unavailable-badge">Coming Soon</span>}
                    {isLocked && !installed && (
                      <span className="status-badge locked-badge" title={lockHint}>
                        🔒 Locked
                      </span>
                    )}
                    {!installed && !isLocked && !isPendingReboot && available && activeSection === 'hardware' && (
                      <>
                        <button
                          className="purchase-btn"
                          onClick={() => handlePurchaseClick(item, 'hardware')}
                          disabled={!purchaseCheck.allowed}
                          title={purchaseCheck.reason || ''}
                          data-testid="purchase-btn"
                        >
                          Purchase
                        </button>
                        {!purchaseCheck.allowed && (
                          <span className="purchase-reason" data-testid="purchase-reason">{purchaseCheck.reason}</span>
                        )}
                      </>
                    )}
                    {!installed && !isLocked && available && activeSection === 'software' && (
                      isLicensed ? (
                        <button
                          className="install-btn purchase-btn"
                          onClick={() => handleInstallLicensed(item)}
                          disabled={isInQueue}
                        >
                          {isInQueue ? 'Downloading...' : 'Install (Licensed)'}
                        </button>
                      ) : (
                        <button
                          className="purchase-btn"
                          onClick={() => handlePurchaseClick(item, 'software')}
                          disabled={isInQueue}
                        >
                          {isInQueue ? 'Downloading...' : 'Purchase'}
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedItem && (
        <div className="modal-overlay" onClick={() => { setShowPurchaseModal(false); setPurchaseWarning(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Purchase {selectedItem.name}?</h3>
            <p>Price: ${selectedItem.price}</p>
            <p>Your Balance: ${getTotalCredits()}</p>
            <p>After Purchase: ${getTotalCredits() - selectedItem.price}</p>
            {purchaseType === 'hardware' && (
              <p className="hardware-notice">⚠️ Hardware requires a system reboot to install.</p>
            )}
            {purchaseWarning && (
              <p className="hardware-warning" data-testid="downgrade-warning">⚠️ {purchaseWarning}</p>
            )}
            <div className="modal-actions">
              <button className="confirm-btn" onClick={handleConfirmPurchase}>
                {purchaseType === 'hardware' ? 'Purchase & Queue for Reboot' : 'Confirm Purchase'}
              </button>
              <button className="cancel-btn" onClick={() => { setShowPurchaseModal(false); setPurchaseWarning(null); }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Portal;

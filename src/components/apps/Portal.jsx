import { useState } from 'react';
import { useGame } from '../../contexts/useGame';
import { HARDWARE_CATALOG, SOFTWARE_CATALOG } from '../../constants/gameConstants';
import { isHardwareInstalled } from '../../utils/helpers';
import { createDownloadItem } from '../../systems/useDownloadManager';
import { isHardwareCategoryUnlocked, isSoftwareUnlocked, getUnlockHint } from '../../systems/UnlockSystem';
import { queueHardwareInstall, hasPendingUpgrade } from '../../systems/HardwareInstallationSystem';
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
  } = useGame();
  const [activeCategory, setActiveCategory] = useState('processors');
  const [activeSection, setActiveSection] = useState('software');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchaseType, setPurchaseType] = useState('software'); // 'software' or 'hardware'

  const handlePurchaseClick = (item, type = 'software') => {
    setSelectedItem(item);
    setPurchaseType(type);
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
      </div>

      {activeSection === 'hardware' && (
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

            // Check if this hardware item is pending reboot
            const isPendingReboot = activeSection === 'hardware' &&
              pendingHardwareUpgrades &&
              hasPendingUpgrade(pendingHardwareUpgrades, activeCategory, item.id);

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
                    <button
                      className="purchase-btn"
                      onClick={() => handlePurchaseClick(item, 'hardware')}
                    >
                      Purchase
                    </button>
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

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedItem && (
        <div className="modal-overlay" onClick={() => setShowPurchaseModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Purchase {selectedItem.name}?</h3>
            <p>Price: ${selectedItem.price}</p>
            <p>Your Balance: ${getTotalCredits()}</p>
            <p>After Purchase: ${getTotalCredits() - selectedItem.price}</p>
            {purchaseType === 'hardware' && (
              <p className="hardware-notice">⚠️ Hardware requires a system reboot to install.</p>
            )}
            <div className="modal-actions">
              <button className="confirm-btn" onClick={handleConfirmPurchase}>
                {purchaseType === 'hardware' ? 'Purchase & Queue for Reboot' : 'Confirm Purchase'}
              </button>
              <button className="cancel-btn" onClick={() => setShowPurchaseModal(false)}>
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

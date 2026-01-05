import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { HARDWARE_CATALOG, SOFTWARE_CATALOG } from '../../constants/gameConstants';
import { isHardwareInstalled } from '../../utils/helpers';
import { createDownloadItem } from '../../systems/useDownloadManager';
import './Portal.css';

const Portal = () => {
  const { hardware, software, bankAccounts, setBankAccounts, setTransactions, currentTime, getTotalCredits, setDownloadQueue, licensedSoftware } = useGame();
  const [activeCategory, setActiveCategory] = useState('processors');
  const [activeSection, setActiveSection] = useState('software');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const handlePurchaseClick = (item) => {
    setSelectedItem(item);
    setShowPurchaseModal(true);
  };

  const handleConfirmPurchase = () => {
    if (!selectedItem) return;

    const totalCredits = getTotalCredits();
    const price = selectedItem.price;

    if (totalCredits < price) {
      alert(`Insufficient credits. Need ${price}, have ${totalCredits}`);
      setShowPurchaseModal(false);
      return;
    }

    // Deduct credits
    const newAccounts = [...bankAccounts];
    if (newAccounts[0]) {
      newAccounts[0].balance -= price;
      setBankAccounts(newAccounts);

      // Add transaction
      setTransactions(prev => [...prev, {
        id: `txn-purchase-${Date.now()}`,
        date: currentTime.toISOString(),
        type: 'expense',
        amount: -price,
        description: `Software Purchase: ${selectedItem.name}`,
        balanceAfter: newAccounts[0].balance,
      }]);

      // Add to download queue - the download manager hook handles progress and completion
      const downloadItem = createDownloadItem(
        selectedItem.id,
        selectedItem.name,
        selectedItem.sizeInMB || 50 // Use actual size from catalog
      );

      setDownloadQueue(prev => [...prev, downloadItem]);
    }

    setShowPurchaseModal(false);
    setSelectedItem(null);
  };

  const handleInstallLicensed = (item) => {
    // Install licensed software without payment
    const downloadItem = createDownloadItem(
      item.id,
      item.name,
      item.sizeInMB || 50
    );
    setDownloadQueue(prev => [...prev, downloadItem]);
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

            return (
              <div
                key={item.id}
                className={`portal-item ${installed ? 'installed' : ''} ${!available ? 'unavailable' : ''}`}
              >
                <div className="item-header">
                  <div className="item-name">{item.name}</div>
                  <div className="item-price">${item.price}</div>
                </div>
                <div className="item-specs">
                  {item.specs && <div>Specs: {item.specs}</div>}
                  {item.capacity && <div>Capacity: {item.capacity}</div>}
                  {item.speed && <div>Speed: {item.speed}Mb/s</div>}
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
                  {!available && <span className="status-badge unavailable-badge">Coming Soon</span>}
                  {!installed && available && activeSection === 'hardware' && (
                    <span className="status-badge purchasable-badge">Hardware (Phase 3)</span>
                  )}
                  {!installed && available && activeSection === 'software' && (
                    isLicensed ? (
                      <button className="install-btn purchase-btn" onClick={() => handleInstallLicensed(item)}>
                        Install (Licensed)
                      </button>
                    ) : (
                      <button className="purchase-btn" onClick={() => handlePurchaseClick(item)}>
                        Purchase
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
            <div className="modal-actions">
              <button className="confirm-btn" onClick={handleConfirmPurchase}>
                Confirm Purchase
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

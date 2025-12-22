import { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { HARDWARE_CATALOG, SOFTWARE_CATALOG } from '../../constants/gameConstants';
import { isHardwareInstalled } from '../../utils/helpers';
import './Portal.css';

const Portal = () => {
  const { hardware } = useGame();
  const [activeCategory, setActiveCategory] = useState('processors');
  const [activeSection, setActiveSection] = useState('hardware');

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
            const installed = activeSection === 'hardware' && isHardwareInstalled(item, hardware);
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
                    <span className="status-badge purchasable-badge">Purchase (Phase 2)</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Portal;

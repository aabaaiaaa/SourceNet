import { getAllSavesFlat } from '../../utils/helpers';

const LoadGameModal = ({ onClose, onLoadSave }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content load-game-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Load Game</h3>
        <div className="load-saves-list">
          {getAllSavesFlat().length === 0 ? (
            <p>No saved games found.</p>
          ) : (
            getAllSavesFlat().map((save, _index) => {
              const userSaves = getAllSavesFlat().filter(s => s.username === save.username);
              const saveIndex = userSaves.findIndex(s => s.savedAt === save.savedAt);

              return (
                <button
                  key={`${save.username}-${save.savedAt}`}
                  className="load-save-btn"
                  onClick={() => onLoadSave(save.username, saveIndex)}
                >
                  <span className="load-save-username">{save.username}</span>
                  <span className="load-save-name">{save.saveName}</span>
                  <span className="load-save-date">{new Date(save.savedAt).toLocaleString()}</span>
                </button>
              );
            })
          )}
        </div>
        <button
          className="modal-close-btn"
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default LoadGameModal;

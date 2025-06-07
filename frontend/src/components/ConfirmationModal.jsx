import React from 'react';

function ConfirmationModal({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirmar",
    cancelText = "Cancelar"
}) {
    if (!isOpen) {
        return null;
    }

    // Estilos transferidos para index.css como .modal-overlay, .modal-content, etc.
    // Usando as classes CSS agora.

    return (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {title && <h2 className="modal-title">{title}</h2>}
                <p className="modal-message">{message}</p>
                <div className="modal-actions">
                    <button onClick={onCancel} className="btn btn-secondary modal-btn">
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="btn btn-danger modal-btn">
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmationModal;
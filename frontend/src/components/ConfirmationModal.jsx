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

    return (
        <div className="modal-overlay"> {/* Nova classe */}
            <div className="modal-content"> {/* Nova classe */}
                {title && <h2 className="modal-title">{title}</h2>} {/* Nova classe */}
                <p className="modal-message">{message}</p> {/* Nova classe */}
                <div className="modal-actions"> {/* Nova classe */}
                    <button onClick={onCancel} className="btn btn-secondary" style={{width: 'auto'}}>
                        {cancelText}
                    </button>
                    <button onClick={onConfirm} className="btn btn-danger" style={{width: 'auto'}}>
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmationModal;
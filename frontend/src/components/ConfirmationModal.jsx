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

    // Estilos podem ser movidos para o seu index.css para melhor organização
    const modalOverlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000, // Garante que fique sobre outros elementos
    };

    const modalContentStyle = {
        backgroundColor: '#fff',
        padding: '30px',
        borderRadius: '8px',
        boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
        width: 'auto',
        maxWidth: '500px',
        textAlign: 'center',
    };

    const modalTitleStyle = {
        marginTop: 0,
        marginBottom: '15px',
        fontSize: '1.5rem',
        color: '#333',
    };

    const modalMessageStyle = {
        marginBottom: '30px',
        fontSize: '1rem',
        color: '#555',
        lineHeight: '1.5',
    };

    const modalActionsStyle = {
        display: 'flex',
        justifyContent: 'flex-end', // Alinha botões à direita por padrão
        gap: '10px',
    };
    
    // As classes .btn, .btn-danger, .btn-secondary vêm do seu index.css
    // Adicionei width: 'auto' para que não ocupem 100% se .btn tiver width: 100%

    return (
        <div style={modalOverlayStyle} onClick={onCancel}> {/* Clicar fora fecha */}
            <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}> {/* Evita fechar ao clicar dentro do modal */}
                {title && <h2 style={modalTitleStyle}>{title}</h2>}
                <p style={modalMessageStyle}>{message}</p>
                <div style={modalActionsStyle}>
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
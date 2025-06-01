// frontend/src/components/GlobalAlert.jsx
import React, { useEffect, useState } from 'react';

function GlobalAlert({ message, type = 'info', onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        setIsVisible(true);
        // Fecha o alerta automaticamente após alguns segundos
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onClose) {
                onClose();
            }
        }, 5000); // Alerta visível por 5 segundos

        return () => clearTimeout(timer); // Limpa o timer se o componente for desmontado
    }, [message, type, onClose]);

    const alertStyle = {
        position: 'fixed',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 25px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: 'bold',
        zIndex: 1000,
        boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
        display: isVisible ? 'flex' : 'none',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '300px',
        maxWidth: '90%',
    };

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return '#28a745'; // Verde
            case 'error':
                return '#dc3545'; // Vermelho
            case 'warning':
                return '#ffc107'; // Amarelo
            case 'info':
            default:
                return '#17a2b8'; // Azul claro
        }
    };

    const closeButtonStyle = {
        background: 'none',
        border: 'none',
        color: 'white',
        fontSize: '1.2em',
        cursor: 'pointer',
        marginLeft: '15px',
    };

    return (
        <div style={{ ...alertStyle, backgroundColor: getBackgroundColor() }}>
            <span>{message}</span>
            <button onClick={() => { setIsVisible(false); if (onClose) onClose(); }} style={closeButtonStyle}>
                &times;
            </button>
        </div>
    );
}

export default GlobalAlert;
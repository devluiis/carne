import React, { useEffect, useState } from 'react';

function GlobalAlert({ message, type = 'info', onClose }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        setIsVisible(true);
        const timer = setTimeout(() => {
            setIsVisible(false);
            if (onClose) {
                onClose();
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [message, type, onClose]);

    // Usando classes CSS para o alerta
    const alertClasses = `global-alert global-alert-${type} ${isVisible ? 'visible' : ''}`;

    return (
        <div className={alertClasses}>
            <span>{message}</span>
            <button onClick={() => { setIsVisible(false); if (onClose) onClose(); }} className="global-alert-close-btn">
                &times;
            </button>
        </div>
    );
}

export default GlobalAlert;
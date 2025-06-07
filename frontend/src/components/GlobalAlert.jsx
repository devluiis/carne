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

    const getBackgroundColor = () => {
        switch (type) {
            case 'success':
                return '#28a745'; 
            case 'error':
                return '#dc3545'; 
            case 'warning':
                return '#ffc107'; 
            case 'info':
            default:
                return '#17a2b8'; 
        }
    };

    return (
        <div className="global-alert" style={{backgroundColor: getBackgroundColor(), display: isVisible ? 'flex' : 'none'}}> {/* Usando classe CSS */}
            <span>{message}</span>
            <button onClick={() => { setIsVisible(false); if (onClose) onClose(); }} className="close-button"> {/* Usando classe CSS */}
                &times;
            </button>
        </div>
    );
}

export default GlobalAlert;
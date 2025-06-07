import React from 'react';

function LoadingSpinner({ size = '50px', thickness = '5px', message = 'Carregando...' }) {
    return (
        <div className="loading-spinner-container">
            <div className="loading-spinner" style={{width: size, height: size, borderWidth: thickness}}></div>
            {message && <p className="loading-spinner-message">{message}</p>}
        </div>
    );
}

export default LoadingSpinner;
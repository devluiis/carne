import React from 'react';

function LoadingSpinner({ size = '50px', thickness = '5px', message = 'Carregando...' }) {
    // Estilos agora usando classes CSS e variáveis CSS para flexibilidade.
    // Keyframes da animação devem estar no index.css
    return (
        <div className="loading-spinner-container">
            <div className="spinner" style={{ width: size, height: size, borderWidth: thickness }}></div>
            {message && <p className="spinner-message">{message}</p>}
        </div>
    );
}

export default LoadingSpinner;
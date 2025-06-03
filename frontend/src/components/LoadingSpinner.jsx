import React from 'react';

function LoadingSpinner({ size = '50px', thickness = '5px', message = 'Carregando...' }) {
    const spinnerStyle = {
        border: `${thickness} solid #f3f3f3`, // Cinza claro
        borderTop: `${thickness} solid #3498db`, // Azul
        borderRadius: '50%',
        width: size,
        height: size,
        animation: 'spin 1s linear infinite',
        margin: '20px auto', // Centraliza o spinner
    };

    const containerStyle = {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '40px',
        minHeight: '300px', // Garante que o spinner tenha espaço
    };

    // Keyframes da animação precisam ser injetados no <head>
    const keyframes = `@keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }`;

    return (
        <div style={containerStyle}>
            <style>{keyframes}</style>
            <div style={spinnerStyle}></div>
            {message && <p style={{ marginTop: '15px', color: '#555', fontWeight: 'bold' }}>{message}</p>}
        </div>
    );
}

export default LoadingSpinner;
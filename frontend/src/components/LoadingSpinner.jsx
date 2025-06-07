import React from 'react';

function LoadingSpinner({ size = '50px', thickness = '5px', message = 'Carregando...' }) {
    return (
        <div className="d-flex flex-column justify-content-center align-items-center p-4" style={{minHeight: '300px'}}> {/* Classes Bootstrap */}
            <div className="spinner-border text-primary" style={{width: size, height: size, borderWidth: thickness}} role="status"> {/* Spinner do Bootstrap */}
                <span className="visually-hidden">Loading...</span> {/* Acessibilidade */}
            </div>
            {message && <p className="mt-3 text-muted fw-bold">{message}</p>} {/* Classes Bootstrap */}
        </div>
    );
}

export default LoadingSpinner;
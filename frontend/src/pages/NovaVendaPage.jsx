import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { clients } from '../api';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';

function NovaVendaPage() {
    const [clientOptions, setClientOptions] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState('');
    const [loadingClients, setLoadingClients] = useState(true);
    
    const navigate = useNavigate();
    const { setGlobalAlert } = useGlobalAlert();

    const fetchClientOptions = useCallback(async () => {
        try {
            setLoadingClients(true);
            const response = await clients.getAll('');
            setClientOptions(response.data || []);
        } catch (err) {
            console.error('Erro ao carregar opções de clientes:', err);
            setGlobalAlert({ message: 'Falha ao carregar lista de clientes.', type: 'error' });
        } finally {
            setLoadingClients(false);
        }
    }, [setGlobalAlert]);

    useEffect(() => {
        fetchClientOptions();
    }, [fetchClientOptions]);

    const handleProceedToCarne = () => {
        if (!selectedClientId) {
            setGlobalAlert({ message: 'Por favor, selecione um cliente para prosseguir.', type: 'warning' });
            return;
        }
        navigate(`/carnes/new/${selectedClientId}`);
    };

    if (loadingClients) {
        return <LoadingSpinner message="Carregando lista de clientes..." />;
    }

    return (
        <div className="form-container large-container"> {/* Mantive large-container para ajuste de max-width */}
            <h2 className="text-center">Registrar Nova Venda / Carnê</h2>
            <p className="text-center" style={{marginBottom: '30px'}}>Selecione o cliente para o qual deseja registrar uma nova venda e gerar um carnê.</p>
            
            <div className="form-group">
                <label htmlFor="client-select">Cliente:</label>
                <select
                    id="client-select"
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="form-select"
                >
                    <option value="">-- Selecione um Cliente --</option>
                    {clientOptions.length > 0 ? (
                        clientOptions.map(client => (
                            <option key={client.id_cliente} value={client.id_cliente}>
                                {client.nome} ({client.cpf_cnpj})
                            </option>
                        ))
                    ) : (
                        <option value="" disabled>Nenhum cliente cadastrado</option>
                    )}
                </select>
            </div>

            <button
                onClick={handleProceedToCarne}
                className="btn btn-primary"
                disabled={!selectedClientId || loadingClients}
                style={{marginTop: '20px'}}
            >
                Prosseguir para Criação do Carnê
            </button>
            <div className="button-group-mt-2"> {/* Nova classe para agrupar botões com margem */}
                <button
                    type="button"
                    onClick={() => navigate('/clients/new')}
                    className="btn btn-success"
                >
                    + Cadastrar Novo Cliente
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/carnes')}
                    className="btn btn-secondary"
                >
                    Cancelar / Ver Carnês
                </button>
            </div>
        </div>
    );
}

export default NovaVendaPage;
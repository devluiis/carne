import React, { useState, useEffect } from 'react';
import { clients } from '../api';
import { useNavigate, useParams } from 'react-router-dom';
import { useGlobalAlert } from '../App.jsx';
import LoadingSpinner from './LoadingSpinner.jsx'; 

function ClientForm() {
    const [nome, setNome] = useState('');
    const [cpfCnpj, setCpfCnpj] = useState('');
    const [endereco, setEndereco] = useState('');
    const [telefone, setTelefone] = useState('');
    const [email, setEmail] = useState('');
    const [formError, setFormError] = useState(''); 
    const [loadingInitial, setLoadingInitial] = useState(false); 
    const [submitLoading, setSubmitLoading] = useState(false); 
    const navigate = useNavigate();
    const { id } = useParams();
    const { setGlobalAlert } = useGlobalAlert();

    const isEditing = Boolean(id);

    useEffect(() => {
        if (isEditing) {
            setLoadingInitial(true);
            clients.getById(id)
                .then(response => {
                    const client = response.data;
                    setNome(client.nome);
                    setCpfCnpj(client.cpf_cnpj);
                    setEndereco(client.endereco || '');
                    setTelefone(client.telefone || '');
                    setEmail(client.email || '');
                })
                .catch(err => {
                    console.error('Erro ao carregar cliente para edição:', err);
                    setGlobalAlert({ message: 'Erro ao carregar dados do cliente.', type: 'error' });
                    navigate('/clients');
                })
                .finally(() => setLoadingInitial(false));
        }
    }, [id, isEditing, navigate, setGlobalAlert]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(''); 
        setSubmitLoading(true);
        const clientData = { nome, cpf_cnpj: cpfCnpj, endereco, telefone, email };

        try {
            if (isEditing) {
                await clients.update(id, clientData);
                setGlobalAlert({ message: 'Cliente atualizado com sucesso!', type: 'success' });
            } else {
                await clients.create(clientData);
                setGlobalAlert({ message: 'Cliente cadastrado com sucesso!', type: 'success' });
            }
            navigate('/clients');
        } catch (err) {
            const errorMessage = `Erro ao salvar cliente: ${err.response?.data?.detail || err.message}`;
            setFormError(errorMessage); 
            setGlobalAlert({ message: errorMessage, type: 'error' });
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loadingInitial) {
        return <LoadingSpinner message={isEditing ? "Carregando dados do cliente..." : "Preparando formulário..."} />;
    }

    return (
        <div className="form-container">
            <h2>{isEditing ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</h2>
            {formError && <p style={{ color: 'red', textAlign: 'center', marginBottom: '15px' }}>{formError}</p>}
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Nome Completo / Razão Social:</label>
                    <input
                        type="text"
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>CPF / CNPJ:</label>
                    <input
                        type="text"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(e.target.value)}
                        required
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Endereço:</label>
                    <input
                        type="text"
                        value={endereco}
                        onChange={(e) => setEndereco(e.target.value)}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Telefone:</label>
                    <input
                        type="text"
                        value={telefone}
                        onChange={(e) => setTelefone(e.target.value)}
                        className="form-input"
                    />
                </div>
                <div className="form-group">
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="form-input"
                    />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                    {submitLoading ? 'Salvando...' : (isEditing ? 'Atualizar Cliente' : 'Cadastrar Cliente')}
                </button>
                <button
                    type="button"
                    onClick={() => navigate('/clients')}
                    className="btn btn-secondary mt-2" 
                >
                    Cancelar
                </button>
            </form>
        </div>
    );
}

export default ClientForm;
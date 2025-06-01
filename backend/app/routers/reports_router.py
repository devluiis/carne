from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app import schemas, crud, models
from app.database import get_db
from app.auth import get_current_active_user, get_current_admin_user
from datetime import date # Importar date para os parâmetros de query

router = APIRouter(prefix="/reports", tags=["Relatórios e Dashboard"])

# Endpoint para Dashboard Resumido (RF021)
@router.get("/dashboard/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary_route(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    """
    Retorna um resumo de dados para o dashboard.
    Acessível por usuários 'atendente' e 'admin'.
    """
    summary_data = crud.get_dashboard_summary(db)
    return summary_data

# NOVO ENDPOINT: Relatório de Recebimentos por Período (RF022)
@router.get("/receipts", response_model=schemas.ReceiptsReportResponse)
def get_receipts_report_route(
    start_date: date = Query(..., description="Data de início do período (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data de fim do período (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    """
    Gera um relatório de recebimentos para um período específico.
    Acessível por usuários 'atendente' e 'admin'.
    """
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de início não pode ser posterior à data de fim."
        )
    
    report_data = crud.get_receipts_report(db, start_date, end_date)
    return report_data

# NOVO ENDPOINT: Relatório de Dívidas por Cliente (RF023)
@router.get("/pending-debts-by-client/{client_id}", response_model=schemas.PendingDebtsReportResponse)
def get_pending_debts_by_client_route(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    """
    Gera um relatório de dívidas pendentes para um cliente específico.
    Acessível por usuários 'atendente' e 'admin'.
    """
    report_data = crud.get_pending_debts_by_client(db, client_id)
    if report_data is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado ou sem dívidas pendentes.")
    return report_data
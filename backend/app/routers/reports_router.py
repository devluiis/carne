# backend/app/routers/reports_router.py
# (Conteúdo original do seu arquivo, que já estava correto na definição do APIRouter)
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app import schemas, crud, models # models importado para current_user type hint
from app.database import get_db
from app.auth import get_current_active_user # Removido get_current_admin_user se não for usado aqui diretamente
from datetime import date

router = APIRouter(prefix="/reports", tags=["Relatórios e Dashboard"])

@router.get("/dashboard/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary_route(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_active_user)):
    summary_data = crud.get_dashboard_summary(db)
    return summary_data

@router.get("/receipts", response_model=schemas.ReceiptsReportResponse)
def get_receipts_report_route(
    start_date: date = Query(..., description="Data de início do período (YYYY-MM-DD)"),
    end_date: date = Query(..., description="Data de fim do período (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A data de início não pode ser posterior à data de fim."
        )
    report_data = crud.get_receipts_report(db, start_date, end_date)
    return report_data

@router.get("/pending-debts-by-client/{client_id}", response_model=schemas.PendingDebtsReportResponse)
def get_pending_debts_by_client_route(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_active_user)
):
    report_data = crud.get_pending_debts_by_client(db, client_id)
    # A função crud.get_pending_debts_by_client já levanta 404 se cliente não encontrado,
    # então não precisamos checar por None aqui se essa é a intenção.
    # No seu crud, ela retorna None se o cliente não é encontrado antes de buscar dívidas.
    if report_data is None: # Mantendo a checagem se o crud pode retornar None para cliente não encontrado
        raise HTTPException(status_code=404, detail="Cliente não encontrado ou sem dívidas pendentes.")
    return report_data
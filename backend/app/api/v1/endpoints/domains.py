import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.config import settings
from app.repositories.domain_repo import DomainRepository
from app.schemas.domain import DomainCreate, DomainOut, DomainDetailOut, DnsRecordOut, DnsVerificationResult
from app.services.crypto_service import CryptoService
from app.services.dns_service import DnsService
from app.api.deps import get_current_admin, log_action

router = APIRouter()


@router.get("/", response_model=List[DomainOut])
async def list_domains(
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    return await domain_repo.list_all()


@router.post("/", response_model=DomainDetailOut)
async def create_domain(
    domain_in: DomainCreate,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    clean_name = domain_in.name.lower().strip()

    existing = await domain_repo.get_by_name(clean_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Domain '{clean_name}' is already registered in the platform."
        )

    mail_host = domain_in.mail_hostname or f"mail.{clean_name}"
    mail_host = mail_host.lower().strip()

    # 1. Generate 2048-bit RSA DKIM keypair
    priv_pem, pub_pem, dkim_dns = CryptoService.generate_dkim_keypair()
    CryptoService.save_dkim_to_disk(clean_name, "mail", priv_pem)

    # 2. Persist domain
    domain = await domain_repo.create(
        name=clean_name,
        mail_hostname=mail_host,
        dkim_priv=priv_pem,
        dkim_pub=pub_pem
    )

    # 3. Create initial expected DNS records
    initial_records = [
        ("A", mail_host, settings.SERVER_IP),
        ("MX", clean_name, f"10 {mail_host}"),
        ("SPF", clean_name, f"v=spf1 mx ip4:{settings.SERVER_IP} ~all"),
        ("DKIM", f"mail._domainkey.{clean_name}", dkim_dns),
        ("DMARC", f"_dmarc.{clean_name}", f"v=DMARC1; p=quarantine; rua=mailto:dmarc@{clean_name}"),
        ("PTR", settings.SERVER_IP, mail_host)
    ]

    for r_type, host, expected in initial_records:
        await domain_repo.upsert_dns_record(
            domain_id=domain.id,
            record_type=r_type,
            host=host,
            expected=expected,
            detected=None,
            status="pending",
            error="Not verified yet"
        )

    await log_action(
        db,
        actor=admin.username,
        action="CREATE_DOMAIN",
        resource_type="domain",
        resource_id=str(domain.id),
        details={"domain": clean_name, "mail_hostname": mail_host}
    )
    await db.commit()

    detail = await domain_repo.get_by_id(domain.id, load_records=True)
    return detail


@router.get("/{domain_id}", response_model=DomainDetailOut)
async def get_domain(
    domain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    domain = await domain_repo.get_by_id(domain_id, load_records=True)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")
    return domain


@router.post("/{domain_id}/verify-dns", response_model=DnsVerificationResult)
async def verify_domain_dns(
    domain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    """
    Executes live verification against public DNS servers for A, MX, SPF, DKIM, DMARC, and PTR.
    Updates database records and marks domain active if verified.
    """
    domain_repo = DomainRepository(db)
    domain = await domain_repo.get_by_id(domain_id, load_records=True)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    dns_service = DnsService()
    results = dns_service.verify_all_domain_records(
        domain_name=domain.name,
        mail_hostname=domain.mail_hostname,
        dkim_selector=domain.dkim_selector,
        expected_dkim_pub=domain.dkim_public_key or "",
        vps_ip=settings.SERVER_IP
    )

    all_verified = True
    updated_records = []

    for r in results:
        record = await domain_repo.upsert_dns_record(
            domain_id=domain.id,
            record_type=r["record_type"],
            host=r["host"],
            expected=r["expected_value"],
            detected=r["detected_value"],
            status=r["status"],
            error=r["error_reason"]
        )
        updated_records.append(record)
        if r["status"] not in ("verified", "warning"):
            all_verified = False

    overall_status = "active" if all_verified else "action_required"
    await domain_repo.update_status(domain, status=overall_status, is_active=all_verified)
    await db.commit()

    return DnsVerificationResult(
        domain_id=domain.id,
        domain_name=domain.name,
        overall_status=overall_status,
        records=updated_records
    )


@router.delete("/{domain_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_domain(
    domain_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    admin = Depends(get_current_admin)
):
    domain_repo = DomainRepository(db)
    domain = await domain_repo.get_by_id(domain_id)
    if not domain:
        raise HTTPException(status_code=404, detail="Domain not found")

    await domain_repo.delete(domain)
    await log_action(
        db,
        actor=admin.username,
        action="DELETE_DOMAIN",
        resource_type="domain",
        resource_id=str(domain_id),
        details={"domain": domain.name}
    )
    await db.commit()

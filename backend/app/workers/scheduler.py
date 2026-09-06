import asyncio
import logging
from datetime import datetime, timezone
from app.core.database import AsyncSessionLocal
from app.repositories.domain_repo import DomainRepository
from app.services.dns_service import DnsService
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("corpmail-worker")


async def run_periodic_dns_checks():
    logger.info("Starting DNS verification worker loop...")
    dns_service = DnsService()

    while True:
        try:
            async with AsyncSessionLocal() as db:
                domain_repo = DomainRepository(db)
                domains = await domain_repo.list_all()

                for domain in domains:
                    if domain.verification_status != "active":
                        logger.info(f"Re-checking DNS records for domain: {domain.name}")
                        results = dns_service.verify_all_domain_records(
                            domain_name=domain.name,
                            mail_hostname=domain.mail_hostname,
                            dkim_selector=domain.dkim_selector,
                            expected_dkim_pub=domain.dkim_public_key or "",
                            vps_ip=settings.SERVER_IP
                        )
                        all_verified = all(r["status"] in ("verified", "warning") for r in results if r["record_type"] != "PTR")
                        for r in results:
                            await domain_repo.upsert_dns_record(
                                domain_id=domain.id,
                                record_type=r["record_type"],
                                host=r["host"],
                                expected=r["expected_value"],
                                detected=r["detected_value"],
                                status=r["status"],
                                error=r["error_reason"]
                            )
                        if all_verified and not domain.is_active:
                            logger.info(f"Domain {domain.name} DNS verified! Activating domain.")
                            await domain_repo.update_status(domain, "active", True)
                await db.commit()
        except Exception as e:
            logger.error(f"Error in DNS worker loop: {e}")

        # Sleep for 15 minutes
        await asyncio.sleep(900)


def main():
    logger.info("Initializing Corporate Mail Platform Background Worker...")
    asyncio.run(run_periodic_dns_checks())


if __name__ == "__main__":
    main()

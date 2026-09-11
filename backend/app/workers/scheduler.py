import asyncio
import logging
from datetime import datetime, timezone
from app.core.database import AsyncSessionLocal
from app.repositories.domain_repo import DomainRepository
from app.services.dns_service import DnsService
from app.services.security_service import SecurityService
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
                            
                            # Automatically trigger SSL provisioning for the verified domain
                            try:
                                logger.info(f"Auto-provisioning SSL for activated domain {domain.name} ({domain.mail_hostname})...")
                                ssl_res = SecurityService.auto_provision_ssl_if_needed(
                                    domain_name=domain.name,
                                    mail_hostname=domain.mail_hostname
                                )
                                logger.info(f"SSL auto-provision result for {domain.name}: {ssl_res.get('status') or ssl_res.get('success')}")
                            except Exception as ssl_err:
                                logger.warning(f"Background SSL auto-provisioning failed for {domain.name}: {ssl_err}")

                await db.commit()
        except Exception as e:
            logger.error(f"Error in DNS worker loop: {e}")

        # Sleep for 15 minutes
        await asyncio.sleep(900)


async def run_periodic_ssl_maintenance():
    """
    Periodic SSL Maintenance Loop:
    1. Runs automated Let's Encrypt certificate renewal checks every 12 hours.
    2. Auto-provisions Let's Encrypt certificates for active domains lacking trusted certificates.
    """
    logger.info("Starting SSL maintenance and renewal worker loop...")
    while True:
        try:
            # Sleep initially for 60 seconds to let services settle
            await asyncio.sleep(60)

            logger.info("Running automated Let's Encrypt renewal check...")
            renew_res = SecurityService.renew_certificates_if_needed()
            logger.info(f"SSL renewal result: {renew_res.get('message')}")

            async with AsyncSessionLocal() as db:
                domain_repo = DomainRepository(db)
                domains = await domain_repo.list_all()
                for domain in domains:
                    if domain.is_active:
                        cert_status = SecurityService.get_ssl_certificate_status(domain.mail_hostname)
                        if not cert_status.get("installed") or cert_status.get("type") != "letsencrypt":
                            logger.info(f"Domain {domain.name} lacks active Let's Encrypt SSL. Checking DNS preflight...")
                            ssl_res = SecurityService.auto_provision_ssl_if_needed(
                                domain_name=domain.name,
                                mail_hostname=domain.mail_hostname
                            )
                            logger.info(f"SSL provisioning for {domain.name}: {ssl_res.get('status') or ssl_res.get('success')}")
        except Exception as e:
            logger.error(f"Error in SSL maintenance loop: {e}")

        # Sleep for 12 hours
        await asyncio.sleep(43200)


async def start_all_workers():
    await asyncio.gather(
        run_periodic_dns_checks(),
        run_periodic_ssl_maintenance()
    )


def main():
    logger.info("Initializing Corporate Mail Platform Background Worker...")
    asyncio.run(start_all_workers())


if __name__ == "__main__":
    main()

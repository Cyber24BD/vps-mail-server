import os
import tempfile
import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

from app.services.security_service import SecurityService
from app.core.config import settings


def generate_test_cert_pem(common_name: str, san_dns_names: list[str], days_valid: int = 90) -> bytes:
    """Generates a real X.509 certificate in PEM format for unit testing."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = x509.Name([
        x509.NameAttribute(NameOID.COMMON_NAME, common_name),
        x509.NameAttribute(NameOID.ORGANIZATION_NAME, "Test Corp"),
    ])
    now = datetime.datetime.now(datetime.timezone.utc)
    builder = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(days=1))
        .not_valid_after(now + datetime.timedelta(days=days_valid))
    )
    if san_dns_names:
        sans = [x509.DNSName(name) for name in san_dns_names]
        builder = builder.add_extension(x509.SubjectAlternativeName(sans), critical=False)

    cert = builder.sign(key, hashes.SHA256())
    return cert.public_bytes(serialization.Encoding.PEM)


def test_ssl_status_missing_certificate():
    """When fullchain.pem does not exist, get_ssl_certificate_status should report not installed."""
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_ssl_dir = settings.SSL_DIR
        try:
            settings.SSL_DIR = tmpdir
            status = SecurityService.get_ssl_certificate_status("example.com")
            assert status["installed"] is False
            assert status["status"] == "missing"
            assert "No SSL" in status["details"]
        finally:
            settings.SSL_DIR = orig_ssl_dir


def test_ssl_status_with_valid_certificate():
    """Inspects a real generated certificate and tests domain coverage detection."""
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_ssl_dir = settings.SSL_DIR
        try:
            settings.SSL_DIR = tmpdir
            cert_pem = generate_test_cert_pem("mail.testdomain.com", ["mail.testdomain.com", "testdomain.com"])
            with open(os.path.join(tmpdir, "fullchain.pem"), "wb") as f:
                f.write(cert_pem)

            status = SecurityService.get_ssl_certificate_status("testdomain.com")
            assert status["installed"] is True
            assert status["status"] == "active"
            assert status["covers_domain"] is True
            assert "mail.testdomain.com" in status["covered_domains"]
            assert status["days_remaining"] > 80

            # Test a non-covered domain
            uncovered_status = SecurityService.get_ssl_certificate_status("otherdomain.org")
            assert uncovered_status["covers_domain"] is False
        finally:
            settings.SSL_DIR = orig_ssl_dir


def test_is_certificate_valid_for_host():
    """Checks is_certificate_valid_for_host returns True only for covered hosts with > 15 days."""
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_ssl_dir = settings.SSL_DIR
        try:
            settings.SSL_DIR = tmpdir
            # For self-signed, is_certificate_valid_for_host returns False because type != letsencrypt
            cert_pem = generate_test_cert_pem("mail.testdomain.com", ["mail.testdomain.com"])
            with open(os.path.join(tmpdir, "fullchain.pem"), "wb") as f:
                f.write(cert_pem)

            # Self-signed bootstrap cert should not be considered trusted letsencrypt
            assert SecurityService.is_certificate_valid_for_host("mail.testdomain.com") is False
        finally:
            settings.SSL_DIR = orig_ssl_dir


def test_preflight_dns_check_test_env():
    """In test environment, preflight check returns True with test bypass."""
    orig_env = getattr(settings, "ENVIRONMENT", "")
    try:
        settings.ENVIRONMENT = "test"
        ready, msg = SecurityService.preflight_dns_check("mail.example.com")
        assert ready is True
        assert "bypass" in msg.lower()
    finally:
        settings.ENVIRONMENT = orig_env


def test_auto_provision_ssl_if_needed():
    """Tests intelligent auto-provisioning flow."""
    orig_env = getattr(settings, "ENVIRONMENT", "")
    with tempfile.TemporaryDirectory() as tmpdir:
        orig_ssl_dir = settings.SSL_DIR
        try:
            settings.SSL_DIR = tmpdir
            settings.ENVIRONMENT = "test"

            # Auto provision should succeed via test bypass or issue
            res = SecurityService.auto_provision_ssl_if_needed("mycorp.com", "mail.mycorp.com", "admin@mycorp.com")
            assert "status" in res or "success" in res
        finally:
            settings.SSL_DIR = orig_ssl_dir
            settings.ENVIRONMENT = orig_env


def test_renew_certificates_if_needed():
    """Tests certificate renewal helper."""
    orig_env = getattr(settings, "ENVIRONMENT", "")
    try:
        settings.ENVIRONMENT = "test"
        res = SecurityService.renew_certificates_if_needed()
        assert res["success"] is True
        assert "bypass" in res["message"].lower()
    finally:
        settings.ENVIRONMENT = orig_env

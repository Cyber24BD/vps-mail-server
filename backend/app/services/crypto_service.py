import os
from typing import Tuple
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from app.core.config import settings


class CryptoService:
    @staticmethod
    def generate_dkim_keypair() -> Tuple[str, str, str]:
        """
        Generates RSA 2048-bit keypair for DKIM email signing.
        Returns: (private_key_pem, public_key_pem, dns_txt_record_value)
        """
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048
        )

        # Private key in PEM format
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        ).decode("utf-8")

        # Public key in PEM format
        public_key = private_key.public_key()
        public_der = public_key.public_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )

        import base64
        pub_b64 = base64.b64encode(public_der).decode("utf-8")
        dns_txt_record = f"v=DKIM1; k=rsa; p={pub_b64}"

        return private_pem, pub_b64, dns_txt_record

    @staticmethod
    def save_dkim_to_disk(domain_name: str, selector: str, private_pem: str) -> str:
        """
        Saves the private DKIM key to the configured directory for Rspamd / OpenDKIM.
        """
        os.makedirs(settings.DKIM_DIR, exist_ok=True)
        key_path = os.path.join(settings.DKIM_DIR, f"{domain_name}.{selector}.key")
        with open(key_path, "w", encoding="utf-8") as f:
            f.write(private_pem)
        try:
            os.chmod(key_path, 0o644)
        except Exception:
            pass
        return key_path

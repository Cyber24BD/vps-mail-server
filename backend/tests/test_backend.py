import pytest
from app.services.crypto_service import CryptoService
from app.core.security import get_password_hash, verify_password, create_access_token, decode_token


def test_dkim_key_generation():
    priv, pub, dkim_dns = CryptoService.generate_dkim_keypair()
    assert "-----BEGIN PRIVATE KEY-----" in priv
    assert "-----BEGIN PUBLIC KEY-----" in pub
    assert dkim_dns.startswith("v=DKIM1; k=rsa; p=")
    assert len(dkim_dns) > 100


def test_password_hashing():
    raw = "SuperSecretCorpMailPass123!"
    hashed = get_password_hash(raw)
    assert hashed != raw
    assert verify_password(raw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_jwt_token_flow():
    payload = {"sub": "admin", "role": "super_admin"}
    token = create_access_token(payload)
    assert isinstance(token, str)
    decoded = decode_token(token)
    assert decoded["sub"] == "admin"
    assert decoded["role"] == "super_admin"

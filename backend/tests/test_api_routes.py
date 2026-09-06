import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app


@pytest.mark.asyncio
async def test_root_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "online"
    assert "version" in response.json()


@pytest.mark.asyncio
async def test_bootstrap_specs_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/bootstrap/system-specs")
    assert response.status_code == 200
    data = response.json()
    assert "public_ip" in data
    assert "cpu_cores" in data
    assert "ram_total_mb" in data
    assert "primary_ports" in data

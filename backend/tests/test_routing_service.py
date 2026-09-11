import pytest
from unittest.mock import AsyncMock, MagicMock
from email.message import EmailMessage
from app.services.routing_service import MessageRoutingService, DeliveryPlan


@pytest.mark.asyncio
async def test_classify_and_route_pure_internal():
    MessageRoutingService.clear_cache()
    mock_db = AsyncMock()

    # Mock settings: enabled
    mock_setting = MagicMock()
    mock_setting.value = {"enabled": True, "same_domain_only": True}

    # Mock mailbox found for it@toamun.com
    mock_mb = MagicMock()
    mock_mb.email = "it@toamun.com"
    mock_mb.is_active = True

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_setting)),  # get_settings
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_mb)),       # mailbox query
    ]

    plan = await MessageRoutingService.classify_and_route(
        sender_email="aksh@toamun.com",
        recipients=["it@toamun.com"],
        db=mock_db
    )

    assert plan.is_pure_internal is True
    assert plan.is_pure_external is False
    assert plan.delivery_mode == "internal_direct"
    assert "it@toamun.com" in plan.internal_recipients
    assert len(plan.external_recipients) == 0


@pytest.mark.asyncio
async def test_classify_and_route_external_domain():
    MessageRoutingService.clear_cache()
    mock_db = AsyncMock()

    mock_setting = MagicMock()
    mock_setting.value = {"enabled": True, "same_domain_only": True}
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_setting))

    plan = await MessageRoutingService.classify_and_route(
        sender_email="aksh@toamun.com",
        recipients=["client@external.com"],
        db=mock_db
    )

    assert plan.is_pure_internal is False
    assert plan.is_pure_external is True
    assert plan.delivery_mode == "standard_smtp"
    assert "client@external.com" in plan.external_recipients
    assert len(plan.internal_recipients) == 0


@pytest.mark.asyncio
async def test_classify_and_route_hybrid():
    MessageRoutingService.clear_cache()
    mock_db = AsyncMock()

    mock_setting = MagicMock()
    mock_setting.value = {"enabled": True, "same_domain_only": True}

    mock_mb = MagicMock()
    mock_mb.email = "it@toamun.com"
    mock_mb.is_active = True

    mock_db.execute.side_effect = [
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_setting)),
        MagicMock(scalar_one_or_none=MagicMock(return_value=mock_mb)),
    ]

    plan = await MessageRoutingService.classify_and_route(
        sender_email="aksh@toamun.com",
        recipients=["it@toamun.com", "client@gmail.com"],
        db=mock_db
    )

    assert plan.is_hybrid is True
    assert plan.delivery_mode == "hybrid"
    assert "it@toamun.com" in plan.internal_recipients
    assert "client@gmail.com" in plan.external_recipients


@pytest.mark.asyncio
async def test_classify_and_route_disabled_setting():
    MessageRoutingService.clear_cache()
    mock_db = AsyncMock()

    mock_setting = MagicMock()
    mock_setting.value = {"enabled": False, "same_domain_only": True}
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_setting))

    plan = await MessageRoutingService.classify_and_route(
        sender_email="aksh@toamun.com",
        recipients=["it@toamun.com"],
        db=mock_db
    )

    # When disabled, all messages follow standard SMTP
    assert plan.is_pure_internal is False
    assert plan.is_pure_external is True
    assert plan.delivery_mode == "standard_smtp"
    assert "it@toamun.com" in plan.external_recipients


def test_stamp_internal_headers():
    msg = EmailMessage()
    msg["From"] = "aksh@toamun.com"
    msg["To"] = "it@toamun.com"
    msg.set_content("Hello from team!")

    MessageRoutingService.stamp_internal_headers(msg, "aksh@toamun.com")

    assert msg.get("X-CorpMail-Delivery") == "Internal-Direct"
    assert msg.get("X-CorpMail-Internal") == "true"
    assert msg.get("X-CorpMail-Sender-Domain") == "toamun.com"


@pytest.mark.asyncio
async def test_settings_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.core.security import create_access_token
    from app.core.database import get_db

    MessageRoutingService.clear_cache()
    token = create_access_token({"sub": "admin", "role": "super_admin", "type": "admin"})
    headers = {"Authorization": f"Bearer {token}"}

    mock_db = AsyncMock()
    mock_db.add = MagicMock()
    mock_setting = MagicMock()
    mock_setting.value = {"enabled": True, "same_domain_only": True, "stamp_internal_header": True}
    mock_db.execute.return_value = MagicMock(scalar_one_or_none=MagicMock(return_value=mock_setting))
    mock_db.commit = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. GET settings
            res_get = await client.get("/api/v1/settings/internal-messaging", headers=headers)
            assert res_get.status_code == 200
            data = res_get.json()
            assert data["enabled"] is True
            assert data["same_domain_only"] is True

            # 2. POST update settings
            res_post = await client.post(
                "/api/v1/settings/internal-messaging",
                headers=headers,
                json={"enabled": False, "same_domain_only": False, "stamp_internal_header": False}
            )
            assert res_post.status_code == 200
            updated = res_post.json()
            assert updated["enabled"] is False
    finally:
        app.dependency_overrides.pop(get_db, None)

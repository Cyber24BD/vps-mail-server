import re
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from email.message import EmailMessage

from app.models.models import SystemSetting, Mailbox
from app.services.maildir_service import MaildirService


class DeliveryPlan(BaseModel):
    internal_recipients: List[str] = []
    external_recipients: List[str] = []
    is_pure_internal: bool = False
    is_pure_external: bool = False
    is_hybrid: bool = False
    delivery_mode: str = "standard_smtp"  # "internal_direct", "standard_smtp", "hybrid"


class MessageRoutingService:
    SETTING_KEY = "internal_direct_messaging_enabled"

    DEFAULT_SETTING: Dict[str, Any] = {
        "enabled": True,
        "same_domain_only": True,
        "stamp_internal_header": True,
        "description": "Inner domain sending bypasses Postfix SMTP and delivers directly as instant in-app message."
    }

    # In-memory cached setting to ensure sub-millisecond route resolution
    _cached_setting: Optional[Dict[str, Any]] = None

    @classmethod
    async def get_settings(cls, db: AsyncSession) -> Dict[str, Any]:
        """
        Retrieves internal messaging policy settings from DB or returns defaults.
        """
        if cls._cached_setting is not None:
            return cls._cached_setting

        try:
            stmt = select(SystemSetting).where(SystemSetting.key == cls.SETTING_KEY)
            res = await db.execute(stmt)
            record = res.scalar_one_or_none()
            if record and isinstance(record.value, dict):
                cls._cached_setting = {**cls.DEFAULT_SETTING, **record.value}
            else:
                cls._cached_setting = dict(cls.DEFAULT_SETTING)
        except Exception:
            cls._cached_setting = dict(cls.DEFAULT_SETTING)

        return cls._cached_setting

    @classmethod
    async def update_settings(
        cls,
        enabled: bool,
        same_domain_only: bool = True,
        stamp_internal_header: bool = True,
        db: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        """
        Updates the internal direct messaging policy in the database.
        """
        new_val = {
            "enabled": bool(enabled),
            "same_domain_only": bool(same_domain_only),
            "stamp_internal_header": bool(stamp_internal_header),
            "description": cls.DEFAULT_SETTING["description"]
        }

        if db:
            stmt = select(SystemSetting).where(SystemSetting.key == cls.SETTING_KEY)
            res = await db.execute(stmt)
            record = res.scalar_one_or_none()
            if record:
                record.value = new_val
            else:
                record = SystemSetting(
                    key=cls.SETTING_KEY,
                    value=new_val,
                    description=new_val["description"]
                )
                db.add(record)
            await db.commit()

        cls._cached_setting = new_val
        return new_val

    @classmethod
    def clear_cache(cls):
        """Clears in-memory settings cache."""
        cls._cached_setting = None

    @classmethod
    async def classify_and_route(
        cls,
        sender_email: str,
        recipients: List[str],
        db: AsyncSession
    ) -> DeliveryPlan:
        """
        Classifies recipient list into internal direct fast-path vs external SMTP delivery.
        """
        sender_clean = sender_email.strip().lower()
        sender_domain = sender_clean.split("@")[-1] if "@" in sender_clean else ""

        config = await cls.get_settings(db)
        is_feature_enabled = config.get("enabled", True)
        same_domain_only = config.get("same_domain_only", True)

        internal_list: List[str] = []
        external_list: List[str] = []

        clean_recipients = list(dict.fromkeys([
            r.strip().lower() for r in recipients if r and "@" in r
        ]))

        if not is_feature_enabled:
            # Feature disabled -> All recipients routed to standard SMTP
            return DeliveryPlan(
                internal_recipients=[],
                external_recipients=clean_recipients,
                is_pure_internal=False,
                is_pure_external=True,
                is_hybrid=False,
                delivery_mode="standard_smtp"
            )

        for rec in clean_recipients:
            rec_domain = rec.split("@")[-1]

            # Domain qualification
            if same_domain_only and rec_domain != sender_domain:
                external_list.append(rec)
                continue

            # Verify local mailbox existence in DB
            try:
                stmt = select(Mailbox).where(Mailbox.email == rec, Mailbox.is_active == True)
                res = await db.execute(stmt)
                mb = res.scalar_one_or_none()
                if mb:
                    internal_list.append(rec)
                else:
                    external_list.append(rec)
            except Exception:
                # If database query fails, fall back to safe external queue
                external_list.append(rec)

        is_pure_internal = len(internal_list) > 0 and len(external_list) == 0
        is_pure_external = len(internal_list) == 0
        is_hybrid = len(internal_list) > 0 and len(external_list) > 0

        delivery_mode = "internal_direct" if is_pure_internal else ("hybrid" if is_hybrid else "standard_smtp")

        return DeliveryPlan(
            internal_recipients=internal_list,
            external_recipients=external_list,
            is_pure_internal=is_pure_internal,
            is_pure_external=is_pure_external,
            is_hybrid=is_hybrid,
            delivery_mode=delivery_mode
        )

    @classmethod
    def stamp_internal_headers(cls, msg: EmailMessage, sender_email: str) -> None:
        """
        Attaches internal origin and fast-path identification headers.
        """
        sender_domain = sender_email.split("@")[-1] if "@" in sender_email else "local"
        msg["X-CorpMail-Delivery"] = "Internal-Direct"
        msg["X-CorpMail-Internal"] = "true"
        msg["X-CorpMail-Sender-Domain"] = sender_domain

import re
from typing import Dict, Any, List, Optional
import httpx


class SpamService:
    """
    Outgoing and incoming spam detection engine.
    Combines local heuristic analysis with Rspamd container evaluation.
    """

    DANGEROUS_EXTENSIONS = {
        ".exe", ".bat", ".cmd", ".scr", ".vbs", ".pif", ".js", ".jar",
        ".msi", ".reg", ".ps1", ".hta", ".com", ".cpl", ".wsf"
    }

    PHISHING_PATTERNS = [
        (r"\b(urgent|immediate)\s+(action|verification|attention)\s+required\b", "Urgent action pressure tactic", 25),
        (r"\b(verify|confirm|validate)\s+your\s+(account|identity|password|wallet|ssn)\b", "Account verification / phishing pattern", 30),
        (r"\b(bank\s+transfer|wire\s+transfer|western\s+union|moneygram)\b", "Financial transfer request", 20),
        (r"\b(crypto|bitcoin|ethereum|usdt|binance)\s+(giveaway|prize|investment|wallet|claim)\b", "Cryptocurrency solicitation", 30),
        (r"\b(congratulations|you\s+won|lottery|unclaimed\s+funds|inheritance)\b", "Lottery or inheritance prize bait", 35),
        (r"\b(click\s+here\s+immediately|account\s+will\s+be\s+suspended|limited\s+time)\b", "Urgency suspension threat", 20),
        (r"\b(undisclosed\s+recipients|secret\s+beneficiary)\b", "Suspicious recipient wording", 15),
    ]

    @classmethod
    def evaluate_outgoing_email(
        cls,
        subject: str,
        body_text: str,
        body_html: Optional[str] = None,
        attachment_names: Optional[List[str]] = None,
        sender: Optional[str] = None,
        recipient: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Evaluates email content and assigns a normalized spam score (0 to 100).
        Returns risk score, rule triggers, and recommendation.
        """
        score = 0
        triggers: List[Dict[str, Any]] = []

        full_content = f"{subject}\n{body_text or ''}\n{body_html or ''}".lower()

        # 1. Attachment security inspection
        if attachment_names:
            for fname in attachment_names:
                ext = "." + fname.split(".")[-1].lower() if "." in fname else ""
                if ext in cls.DANGEROUS_EXTENSIONS:
                    score += 55
                    triggers.append({
                        "rule": "BLOCKED_ATTACHMENT_TYPE",
                        "description": f"Dangerous executable or script file detected: '{fname}'",
                        "points": 55,
                        "severity": "critical"
                    })

        # 2. Phishing keyword patterns
        for pattern, desc, points in cls.PHISHING_PATTERNS:
            if re.search(pattern, full_content, re.IGNORECASE):
                score += points
                triggers.append({
                    "rule": "PHISHING_PATTERN",
                    "description": desc,
                    "points": points,
                    "severity": "high" if points >= 25 else "medium"
                })

        # 3. Structural Analysis: Excessive Capitalization
        if subject and len(subject) >= 10:
            caps_count = sum(1 for c in subject if c.isupper())
            caps_ratio = caps_count / len(subject)
            if caps_ratio > 0.65:
                score += 20
                triggers.append({
                    "rule": "SUBJECT_ALL_CAPS",
                    "description": "Subject line has excessive capital letters",
                    "points": 20,
                    "severity": "medium"
                })

        # 4. Excessive Exclamation / Dollar signs
        exclamations = subject.count("!") + (body_text or "").count("!")
        dollars = subject.count("$") + (body_text or "").count("$")
        if exclamations >= 4 or dollars >= 4:
            score += 15
            triggers.append({
                "rule": "EXCESSIVE_SYMBOLS",
                "description": "Abnormal volume of exclamation marks or currency symbols",
                "points": 15,
                "severity": "low"
            })

        # 5. Raw IP Address in HTML links
        if body_html:
            raw_ip_urls = re.findall(r'href=[\'"]https?://\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}', body_html, re.IGNORECASE)
            if raw_ip_urls:
                score += 35
                triggers.append({
                    "rule": "RAW_IP_URL",
                    "description": "Email contains raw IP links instead of verified domain names",
                    "points": 35,
                    "severity": "high"
                })

            # Check for hidden/zero-font text (classic spam bypass technique)
            if re.search(r'font-size:\s*0px|display:\s*none', body_html, re.IGNORECASE):
                score += 30
                triggers.append({
                    "rule": "HIDDEN_TEXT_DETECTION",
                    "description": "Hidden text styling detected in HTML body",
                    "points": 30,
                    "severity": "high"
                })

        # 6. Empty subject check
        if not subject.strip():
            score += 10
            triggers.append({
                "rule": "EMPTY_SUBJECT",
                "description": "Email subject is empty",
                "points": 10,
                "severity": "low"
            })

        # Cap score between 0 and 100
        normalized_score = min(100, max(0, score))

        if normalized_score >= 70:
            verdict = "rejected"
            risk_level = "critical"
            recommendation = "Message classified as high-risk spam/phishing. Please remove flagged content or dangerous attachments before dispatching."
        elif normalized_score >= 35:
            verdict = "warning"
            risk_level = "moderate"
            recommendation = "Message contains trigger phrases that may reduce inbox deliverability. Consider revising."
        else:
            verdict = "clean"
            risk_level = "low"
            recommendation = "Message passed all spam deliverability heuristics."

        return {
            "score": normalized_score,
            "verdict": verdict,
            "risk_level": risk_level,
            "recommendation": recommendation,
            "triggers": triggers,
            "is_safe": normalized_score < 70
        }

    @classmethod
    async def check_with_rspamd(cls, raw_mime_content: bytes) -> Dict[str, Any]:
        """
        Queries live Rspamd container (http://rspamd:11333/checkv2) if available.
        Falls back smoothly if offline.
        """
        rspamd_url = "http://rspamd:11333/checkv2"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post(rspamd_url, content=raw_mime_content)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "available": True,
                        "score": data.get("score", 0.0),
                        "required_score": data.get("required_score", 15.0),
                        "action": data.get("action", "no action"),
                        "symbols": list(data.get("symbols", {}).keys())
                    }
        except Exception:
            pass

        return {"available": False, "details": "Rspamd container offline or unreachable"}

    @classmethod
    async def learn_spam(cls, raw_mime_content: bytes) -> bool:
        """
        Feeds spam message to Rspamd training endpoint.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post("http://rspamd:11334/learnspam", content=raw_mime_content)
                return res.status_code == 200
        except Exception:
            return False

    @classmethod
    async def learn_ham(cls, raw_mime_content: bytes) -> bool:
        """
        Feeds ham (legitimate) message to Rspamd training endpoint.
        """
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post("http://rspamd:11334/learnham", content=raw_mime_content)
                return res.status_code == 200
        except Exception:
            return False

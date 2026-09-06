import socket
from typing import Dict, Any, List, Optional
import dns.resolver
import dns.reversename
from app.core.config import settings


class DnsService:
    def __init__(self, nameservers: Optional[List[str]] = None):
        self.resolver = dns.resolver.Resolver()
        self.resolver.timeout = 3.0
        self.resolver.lifetime = 3.0
        if nameservers:
            self.resolver.nameservers = nameservers
        else:
            # Use public resolvers (Cloudflare & Google) to check actual global DNS propagation
            self.resolver.nameservers = ["1.1.1.1", "8.8.8.8"]

    def query_a_record(self, hostname: str) -> Dict[str, Any]:
        try:
            answers = self.resolver.resolve(hostname, "A")
            ips = [rdata.address for rdata in answers]
            return {"status": "success", "detected": ", ".join(ips), "ips": ips}
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return {"status": "missing", "detected": None, "error": "No A record found"}
        except Exception as e:
            return {"status": "pending", "detected": None, "error": str(e)}

    def query_mx_record(self, domain_name: str) -> Dict[str, Any]:
        try:
            answers = self.resolver.resolve(domain_name, "MX")
            records = [f"{rdata.preference} {rdata.exchange.to_text().rstrip('.')}" for rdata in answers]
            return {"status": "success", "detected": ", ".join(records), "records": records}
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return {"status": "missing", "detected": None, "error": "No MX record found"}
        except Exception as e:
            return {"status": "pending", "detected": None, "error": str(e)}

    def query_txt_record(self, name: str) -> Dict[str, Any]:
        try:
            answers = self.resolver.resolve(name, "TXT")
            records = []
            for rdata in answers:
                text = "".join([part.decode("utf-8") if isinstance(part, bytes) else str(part) for part in rdata.strings])
                records.append(text)
            return {"status": "success", "detected": " | ".join(records), "records": records}
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return {"status": "missing", "detected": None, "error": "No TXT record found"}
        except Exception as e:
            return {"status": "pending", "detected": None, "error": str(e)}

    def query_ptr_record(self, ip_address: str) -> Dict[str, Any]:
        try:
            rev_name = dns.reversename.from_address(ip_address)
            answers = self.resolver.resolve(rev_name, "PTR")
            ptrs = [rdata.target.to_text().rstrip('.') for rdata in answers]
            return {"status": "success", "detected": ", ".join(ptrs), "ptrs": ptrs}
        except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
            return {"status": "missing", "detected": None, "error": "No PTR (Reverse DNS) record configured"}
        except Exception as e:
            return {"status": "pending", "detected": None, "error": str(e)}

    def verify_all_domain_records(
        self,
        domain_name: str,
        mail_hostname: str,
        dkim_selector: str,
        expected_dkim_pub: str,
        vps_ip: str
    ) -> List[Dict[str, Any]]:
        """
        Executes full validation suite across A, MX, SPF, DKIM, DMARC, and PTR records.
        """
        results = []

        # 1. Mail Hostname A Record
        res_a = self.query_a_record(mail_hostname)
        status_a = "verified" if res_a.get("detected") and vps_ip in res_a["detected"] else (
            "incorrect" if res_a.get("detected") else "missing"
        )
        results.append({
            "record_type": "A",
            "host": mail_hostname,
            "expected_value": vps_ip,
            "detected_value": res_a.get("detected"),
            "status": status_a,
            "error_reason": res_a.get("error") if status_a != "verified" else None
        })

        # 2. Domain MX Record
        expected_mx = f"10 {mail_hostname}"
        res_mx = self.query_mx_record(domain_name)
        status_mx = "missing"
        if res_mx.get("detected"):
            status_mx = "verified" if mail_hostname in res_mx["detected"] else "incorrect"
        results.append({
            "record_type": "MX",
            "host": domain_name,
            "expected_value": expected_mx,
            "detected_value": res_mx.get("detected"),
            "status": status_mx,
            "error_reason": res_mx.get("error") if status_mx != "verified" else None
        })

        # 3. SPF (TXT Record)
        expected_spf = f"v=spf1 mx ip4:{vps_ip} ~all"
        res_spf = self.query_txt_record(domain_name)
        status_spf = "missing"
        detected_spf = None
        if res_spf.get("records"):
            for rec in res_spf["records"]:
                if "v=spf1" in rec:
                    detected_spf = rec
                    break
            if detected_spf:
                status_spf = "verified" if ("mx" in detected_spf or vps_ip in detected_spf) else "warning"
        results.append({
            "record_type": "SPF",
            "host": domain_name,
            "expected_value": expected_spf,
            "detected_value": detected_spf,
            "status": status_spf,
            "error_reason": res_spf.get("error") if status_spf not in ("verified", "warning") else None
        })

        # 4. DKIM (TXT Record)
        dkim_host = f"{dkim_selector}._domainkey.{domain_name}"
        clean_pub = (expected_dkim_pub or "")\
            .replace("-----BEGIN PUBLIC KEY-----", "")\
            .replace("-----END PUBLIC KEY-----", "")\
            .replace("\n", "")\
            .replace("\r", "")\
            .replace(" ", "")\
            .strip()
        expected_dkim = f"v=DKIM1; k=rsa; p={clean_pub}"
        res_dkim = self.query_txt_record(dkim_host)
        status_dkim = "missing"
        detected_dkim = None
        if res_dkim.get("records"):
            detected_dkim = res_dkim["records"][0]
            status_dkim = "verified" if "v=DKIM1" in detected_dkim else "incorrect"
        results.append({
            "record_type": "DKIM",
            "host": dkim_host,
            "expected_value": expected_dkim,
            "detected_value": detected_dkim,
            "status": status_dkim,
            "error_reason": res_dkim.get("error") if status_dkim != "verified" else None
        })

        # 5. DMARC (TXT Record)
        dmarc_host = f"_dmarc.{domain_name}"
        expected_dmarc = f"v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@{domain_name}"
        res_dmarc = self.query_txt_record(dmarc_host)
        status_dmarc = "missing"
        detected_dmarc = None
        if res_dmarc.get("records"):
            for rec in res_dmarc["records"]:
                if "v=DMARC1" in rec:
                    detected_dmarc = rec
                    break
            if detected_dmarc:
                status_dmarc = "verified"
        results.append({
            "record_type": "DMARC",
            "host": dmarc_host,
            "expected_value": expected_dmarc,
            "detected_value": detected_dmarc,
            "status": status_dmarc,
            "error_reason": res_dmarc.get("error") if status_dmarc != "verified" else None
        })

        # 6. PTR / Reverse DNS
        res_ptr = self.query_ptr_record(vps_ip)
        status_ptr = "missing"
        if res_ptr.get("detected"):
            status_ptr = "verified" if mail_hostname in res_ptr["detected"] else "warning"
        results.append({
            "record_type": "PTR",
            "host": vps_ip,
            "expected_value": mail_hostname,
            "detected_value": res_ptr.get("detected"),
            "status": status_ptr,
            "error_reason": res_ptr.get("error") if status_ptr not in ("verified", "warning") else None
        })

        return results

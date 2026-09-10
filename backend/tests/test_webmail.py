import os
import shutil
import tempfile
import pytest
from app.services.spam_service import SpamService
from app.services.maildir_service import MaildirService
from app.core.config import settings


@pytest.fixture(autouse=True)
def temp_vmail_dir(monkeypatch):
    temp_dir = tempfile.mkdtemp(prefix="corpmail_test_vmail_")
    monkeypatch.setattr(settings, "VMAIL_DIR", temp_dir)
    yield temp_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


def test_spam_detection_clean_vs_phishing():
    # 1. Clean corporate message
    clean_eval = SpamService.evaluate_outgoing_email(
        subject="Project Quarterly Review - Q3 Update",
        body_text="Hi team, attached is the revised agenda for tomorrow's engineering sync. Let me know if you have questions.",
        body_html="<p>Hi team, attached is the revised agenda for tomorrow's engineering sync.</p>",
        attachment_names=["quarterly_review.pdf"]
    )
    assert clean_eval["is_safe"] is True
    assert clean_eval["verdict"] == "clean"
    assert clean_eval["score"] <= 30

    # 2. Dangerous attachment
    danger_attach_eval = SpamService.evaluate_outgoing_email(
        subject="Invoice details",
        body_text="Please check the invoice.",
        attachment_names=["invoice_payment.exe"]
    )
    assert danger_attach_eval["score"] >= 55
    assert any(t["rule"] == "BLOCKED_ATTACHMENT_TYPE" for t in danger_attach_eval["triggers"])

    # 3. Phishing scam solicitation
    phishing_eval = SpamService.evaluate_outgoing_email(
        subject="URGENT: IMMEDIATE VERIFICATION REQUIRED FOR YOUR BITCOIN WALLET!!!",
        body_text="Verify your password immediately or your crypto wallet will be suspended. You won the prize of unclaimed funds!",
        body_html='<a href="http://192.168.1.100/login">Click here immediately</a>'
    )
    assert phishing_eval["is_safe"] is False
    assert phishing_eval["verdict"] == "rejected"
    assert phishing_eval["score"] >= 70


def test_maildir_provisioning_and_summary():
    test_user = "alice@example.com"
    summary = MaildirService.get_mailbox_folders_summary(test_user, quota_bytes=1000000)

    assert len(summary["folders"]) >= 5
    folder_keys = [f["key"] for f in summary["folders"]]
    assert "inbox" in folder_keys
    assert "sent" in folder_keys
    assert "trash" in folder_keys
    assert "spam" in folder_keys
    assert summary["bytes_used"] == 0
    assert summary["messages_used"] == 0


def test_incoming_mail_and_state_transitions():
    test_user = "bob@example.com"

    # Inject sample email
    msg_id = MaildirService.inject_sample_email(test_user, sample_type="welcome")
    assert msg_id is not None

    # Check unread count
    summary = MaildirService.get_mailbox_folders_summary(test_user)
    inbox_folder = next(f for f in summary["folders"] if f["key"] == "inbox")
    assert inbox_folder["total"] == 1
    assert inbox_folder["unread"] == 1

    # List messages
    msgs = MaildirService.list_messages(test_user, folder_key="inbox")
    assert len(msgs) == 1
    assert msgs[0]["subject"] == "Welcome to your Corporate Webmail"
    assert msgs[0]["is_read"] is False

    # Read message detail (auto marks as read)
    detail = MaildirService.get_message_detail(test_user, folder_key="inbox", message_id=msgs[0]["id"])
    assert detail is not None
    assert "Corporate Mail Platform" in detail["body_html"]
    assert detail["is_read"] is True

    # Check updated unread count (should now be 0 unread)
    summary_after = MaildirService.get_mailbox_folders_summary(test_user)
    inbox_after = next(f for f in summary_after["folders"] if f["key"] == "inbox")
    assert inbox_after["total"] == 1
    assert inbox_after["unread"] == 0

    # Move message to Trash
    moved = MaildirService.move_message(test_user, from_folder="inbox", to_folder="trash", message_id=detail["id"])
    assert moved is True

    # Verify inbox is empty and trash has 1
    inbox_msgs = MaildirService.list_messages(test_user, folder_key="inbox")
    assert len(inbox_msgs) == 0

    trash_msgs = MaildirService.list_messages(test_user, folder_key="trash")
    assert len(trash_msgs) == 1

    # Delete permanently from trash
    deleted = MaildirService.delete_message(test_user, folder_key="trash", message_id=trash_msgs[0]["id"])
    assert deleted is True

    trash_msgs_after = MaildirService.list_messages(test_user, folder_key="trash")
    assert len(trash_msgs_after) == 0


def test_bulk_operations():
    test_user = "charlie@example.com"

    # Inject 3 messages
    mid1 = MaildirService.inject_sample_email(test_user, sample_type="test")
    mid2 = MaildirService.inject_sample_email(test_user, sample_type="test")
    mid3 = MaildirService.inject_sample_email(test_user, sample_type="welcome")

    msgs = MaildirService.list_messages(test_user, folder_key="inbox")
    assert len(msgs) == 3

    # Bulk mark as read
    affected_read = MaildirService.execute_bulk_action(
        mailbox_email=test_user,
        action="mark_read",
        message_ids=[msgs[0]["id"], msgs[1]["id"]],
        from_folder="inbox"
    )
    assert affected_read == 2

    # Bulk move to Archive
    affected_move = MaildirService.execute_bulk_action(
        mailbox_email=test_user,
        action="move",
        message_ids=[msgs[0]["id"], msgs[1]["id"]],
        from_folder="inbox",
        to_folder="archive"
    )
    assert affected_move == 2

    archive_msgs = MaildirService.list_messages(test_user, folder_key="archive")
    assert len(archive_msgs) == 2

    # Bulk delete from inbox
    affected_del = MaildirService.execute_bulk_action(
        mailbox_email=test_user,
        action="delete",
        message_ids=[msgs[2]["id"]],
        from_folder="inbox"
    )
    assert affected_del == 1

    inbox_msgs = MaildirService.list_messages(test_user, folder_key="inbox")
    assert len(inbox_msgs) == 0


def test_attachment_extraction_and_download():
    from email.message import EmailMessage
    test_user = "diana@example.com"

    msg = EmailMessage()
    msg["From"] = "Sender <sender@example.com>"
    msg["To"] = test_user
    msg["Subject"] = "Document with Attachment"
    msg.set_content("Please find the attached document.")
    msg.add_attachment(b"Report Content 123", maintype="text", subtype="plain", filename="report.txt")

    raw_bytes = msg.as_bytes()
    saved_id = MaildirService.save_message(test_user, "inbox", raw_bytes, is_read=False)

    detail = MaildirService.get_message_detail(test_user, "inbox", saved_id)
    assert detail is not None
    assert detail["has_attachment"] is True
    assert len(detail["attachments"]) == 1
    assert detail["attachments"][0]["filename"] == "report.txt"

    # Download attachment
    payload, name, ctype = MaildirService.get_attachment_bytes(test_user, "inbox", detail["id"], 0)
    assert payload == b"Report Content 123"
    assert name == "report.txt"
    assert "text/plain" in ctype

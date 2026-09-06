FROM alpine:3.20

RUN apk add --no-cache \
    dovecot \
    dovecot-pgsql \
    dovecot-lmtpd \
    ca-certificates \
    bash \
    tzdata

RUN addgroup -g 5000 -S vmail 2>/dev/null || true && \
    adduser -u 5000 -S -G vmail -h /var/mail-platform/vmail -s /sbin/nologin vmail 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 24 143 993 12345

ENTRYPOINT ["/entrypoint.sh"]

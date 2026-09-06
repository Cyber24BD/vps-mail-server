FROM alpine:3.20

RUN apk add --no-cache \
    postfix \
    postfix-pgsql \
    cyrus-sasl \
    cyrus-sasl-login \
    ca-certificates \
    bash \
    tzdata

RUN addgroup -g 5000 -S vmail 2>/dev/null || true && \
    adduser -u 5000 -S -G vmail -h /var/mail-platform/vmail -s /sbin/nologin vmail 2>/dev/null || true

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 25 465 587

ENTRYPOINT ["/entrypoint.sh"]

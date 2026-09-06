# Worker controller for Rspamd web UI & metrics
bind_socket = "*:11334";
password = "$2y$10$abcdefghijklmnopqrstuvwxyz1234567890"; # Default hash, overridden in env
secure_ip = ["127.0.0.1", "::1", "172.16.0.0/12"];

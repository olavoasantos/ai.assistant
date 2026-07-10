FROM nginx

COPY infrastructure/nginx/etc /etc/
COPY infrastructure/*/*.conf /etc/nginx/sites-enabled/
# COPY apps/*/infrastructure/*.conf /etc/nginx/sites-enabled/

FROM mariadb:11.2

# Copiar scripts de inicialización
COPY docker/mariadb/init-credentials.sh /usr/local/bin/
COPY docker/mariadb/secure-mariadb.sql /docker-entrypoint-initdb.d/

# Hacer ejecutable el script de credenciales y corregir finales de línea
RUN apt-get update && apt-get install -y dos2unix && \
    dos2unix /usr/local/bin/init-credentials.sh && \
    chmod +x /usr/local/bin/init-credentials.sh && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Usar nuestro script como entrypoint
ENTRYPOINT ["/usr/local/bin/init-credentials.sh"]
CMD ["mariadbd"]

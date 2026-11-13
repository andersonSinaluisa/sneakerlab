# Réplica local de un hosting compartido: PHP 8.2 + Apache con .htaccess (mod_rewrite) y pdo_mysql.
FROM php:8.2-apache
RUN docker-php-ext-install pdo_mysql \
 && a2enmod rewrite headers deflate \
 && sed -ri 's#/var/www/html#/srv/site/public_html#g' /etc/apache2/sites-available/000-default.conf /etc/apache2/apache2.conf \
 && printf '<Directory /srv/site/public_html>\n  AllowOverride All\n  Require all granted\n</Directory>\n' > /etc/apache2/conf-enabled/site.conf \
 && printf 'upload_max_filesize=20M\npost_max_size=20M\nmemory_limit=256M\n' > /usr/local/etc/php/conf.d/sneakerlab.ini
WORKDIR /srv/site

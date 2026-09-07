# Déploiement sur Raspberry Pi 4

Le site fonctionne uniquement avec Apache2 et PHP : aucun processus Node.js n'est nécessaire.

## Installation

1. Installer les modules : `sudo apt install apache2 libapache2-mod-php php-opcache`.
2. Activer les optimisations : `sudo a2enmod rewrite headers expires deflate brotli` (ignorer `brotli` s'il n'est pas disponible).
3. Copier le projet dans `/var/www/html/playground`.
4. Copier `deploy/apache-playground.conf` dans `/etc/apache2/sites-available/playground.conf`.
5. Copier `deploy/php-playground.ini` dans le dossier `conf.d` indiqué dans le fichier.
6. Activer le site : `sudo a2ensite playground && sudo systemctl reload apache2`.

Pour une carte microSD, monter `/tmp` en mémoire vive réduit les écritures produites par les salons. Les salons sont déjà placés dans le répertoire temporaire de PHP et expirent automatiquement.

## Réglages conseillés

- Raspberry Pi OS 64 bits.
- Apache MPM `prefork` avec environ 20 workers maximum si `libapache2-mod-php` est utilisé.
- Mode de performances du site sur `Automatique` : un Pi 4 démarre en qualité moyenne, sans ombres WebGL coûteuses, puis s'ajuste aux FPS mesurés.
- Ethernet recommandé pour héberger plusieurs parties simultanées.

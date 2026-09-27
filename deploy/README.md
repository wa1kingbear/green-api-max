# Production deployment assets

Эти файлы подготавливают статический атомарный деплой, но не содержат значений
конкретного сервера и не должны применяться без проверки на VPS.

## Nginx

Для временного стенда без домена используется
`nginx/green-api-max.http.conf.template`. В нём нужно заменить:

- `__SERVER_NAME__` — публичный IP VPS;
- `__DEPLOY_PATH__` — абсолютный каталог приложения.

Этот вариант обслуживает стенд только по HTTP и не включает HSTS. Он подходит
для демонстрации тестового задания, но не заменяет HTTPS для production-сервиса.

Проверка временного HTTP-стенда:

```bash
sudo nginx -t
curl --fail --silent --show-error http://<server-ip>/healthz
```

Перед установкой `nginx/green-api-max.conf.template` нужно заменить:

- `__DOMAIN__` — production-домен;
- `__DEPLOY_PATH__` — абсолютный каталог приложения, например
  `/var/www/green-api-chat`;
- `__ACME_ROOT__` — webroot для ACME challenge;
- `__TLS_CERTIFICATE__` и `__TLS_CERTIFICATE_KEY__` — пути к сертификату и ключу.

Если GREEN-API использует другой API host, его нужно отдельно разрешить в
директиве CSP `connect-src`. HSTS включается только после получения сертификата и
успешной проверки HTTPS.

Перед reload HTTPS-конфигурации обязательны:

```bash
sudo nginx -t
curl --fail --silent --show-error https://<domain>/healthz
```

## Releases

Ожидаемая структура:

```text
<deploy-root>/
  current -> releases/<commit-sha>
  previous -> releases/<previous-commit-sha>
  incoming/
  releases/
```

Архив должен содержать содержимое `dist` с `index.html` в корне. Команды на VPS:

```bash
deploy/scripts/release.sh activate <deploy-root> <commit-sha> \
  <deploy-root>/incoming/<commit-sha>.tar.gz
deploy/scripts/release.sh rollback <deploy-root>
deploy/scripts/release.sh prune <deploy-root> 5
```

`activate` сначала полностью распаковывает и проверяет релиз, а затем атомарно
переключает `current`. `rollback` меняет местами `current` и `previous`. `prune`
удаляет старые каталоги, сохраняя не менее пяти последних релизов и оба активных
указателя.

Обычный deploy выполняется пользователем `deploy` без root-доступа. Root нужен
только для первоначальной установки Nginx, сертификата и прав на каталог.

## GitHub Actions

Workflow `.github/workflows/deploy.yml` запускает деплой только для `main`:

- автоматически после успешного workflow `CI`, вызванного push в `main`;
- вручную через `workflow_dispatch`, только если выбрана ветка `main`.

В GitHub Environment `production` должны быть заданы secrets:

```text
VPS_HOST
VPS_PORT
VPS_USER
VPS_SSH_PRIVATE_KEY
VPS_KNOWN_HOSTS
DEPLOY_PATH
PRODUCTION_URL
```

Для тестового стенда без домена `PRODUCTION_URL` имеет вид
`http://<server-ip>`. Используется отдельный deploy-ключ без пароля; личный
SSH-ключ разработчика в GitHub Secrets не добавляется.

Workflow повторно собирает выбранный commit, загружает архив в `incoming`,
атомарно переключает `current`, проверяет `/healthz` и главную страницу,
откатывается при неуспешной проверке и оставляет пять последних релизов.

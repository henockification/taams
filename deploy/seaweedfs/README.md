# SeaweedFS object storage on Dokploy

S3-compatible file storage for TAAMS, running as its own Dokploy Compose
application alongside the API and frontend.

## Topology

One container runs master + volume server + filer + S3 gateway against a single
Docker volume (`seaweedfs_data`). That is the right shape for a single Ubuntu
host: fewer moving parts, one thing to back up. Split into separate services
only when you actually move to multiple machines.

The stack publishes **no host ports**. It joins `dokploy-network`, the shared
network Dokploy creates for Traefik, and the API reaches it as
`http://seaweedfs:8333`. Nothing is exposed to the internet unless you
deliberately attach a domain (see "Optional: public S3 endpoint").

| Port | Service     | Purpose                        |
| ---- | ----------- | ------------------------------ |
| 8333 | S3 API      | What the API talks to          |
| 8888 | Filer HTTP  | Browsing / debugging           |
| 9333 | Master UI   | Cluster status, health check   |

## 1. Generate credentials

On your laptop or the server:

```bash
openssl rand -hex 10   # -> SEAWEEDFS_ACCESS_KEY
openssl rand -hex 32   # -> SEAWEEDFS_SECRET_KEY
```

Use hex output only. The credentials file is rendered by a shell heredoc at
container start, so a key containing `$`, backtick, `"` or `\` would be
mangled.

## 2. Create the Dokploy application

In the Dokploy dashboard:

1. Open your project → **Create Service** → **Compose**.
2. Name it `seaweedfs`.
3. **Provider**: point it at this repository, branch `main`.
4. **Compose Path**: `deploy/seaweedfs/docker-compose.yml`
5. Save.

## 3. Set the environment

On the `seaweedfs` service, open the **Environment** tab and paste the contents
of [`.env.example`](./.env.example), replacing both `replace-me` values with the
keys from step 1. Save.

## 4. Deploy

Hit **Deploy**. Watch the **Logs** tab — a healthy start ends with lines like:

```
Start Seaweed Master ... at 0.0.0.0:9333
Start Seaweed S3 API Server ... at http://0.0.0.0:8333
```

Verify from an SSH session on the server:

```bash
docker ps --filter name=seaweedfs
docker exec -it $(docker ps -qf name=seaweedfs) \
  curl -fsS http://localhost:9333/healthz     # liveness, returns 200
docker exec -it $(docker ps -qf name=seaweedfs) \
  curl -fsS http://localhost:9333/dir/status  # cluster topology as JSON
```

## 5. Create the bucket

The stack runs with `-s3.autoCreateBucket` at its default (enabled) and the app
identity has the `Admin` action, so the `taams` bucket is created on first
upload. To create it up front instead:

```bash
docker exec -i $(docker ps -qf name=seaweedfs) \
  weed shell -master=localhost:9333 <<< 's3.bucket.create -name taams'
```

List buckets to confirm:

```bash
docker exec -i $(docker ps -qf name=seaweedfs) \
  weed shell -master=localhost:9333 <<< 's3.bucket.list'
```

## 6. Point the API at it

On the **API** Dokploy application, add to its Environment tab:

```
S3_ENDPOINT=http://seaweedfs:8333
S3_ACCESS_KEY_ID=<SEAWEEDFS_ACCESS_KEY>
S3_SECRET_ACCESS_KEY=<SEAWEEDFS_SECRET_KEY>
S3_BUCKET=taams
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
```

These are read at runtime by [`apps/api/lib/storage.ts`](../../apps/api/lib/storage.ts),
so no Dockerfile rebuild is required — a redeploy of the API is enough.

Redeploy the API, then confirm connectivity from inside the API container:

```bash
docker exec -it $(docker ps -qf name=taams-api) \
  curl -fsS -o /dev/null -w '%{http_code}\n' http://seaweedfs:8333
```

A `403` here is success: the S3 gateway is reachable and rejecting the
unsigned request. `000` or a DNS error means the two stacks are not on the same
network — check that the API service also joins `dokploy-network`.

## Using it from the API

```ts
import { buildObjectKey, uploadObject, getPresignedDownloadUrl } from '../lib/storage';

const key = buildObjectKey(`employees/${employeeId}/documents`, file.name);
await uploadObject({
  key,
  body: Buffer.from(await file.arrayBuffer()),
  contentType: file.type,
});

const url = await getPresignedDownloadUrl(key, { downloadFilename: file.name });
```

The module also exports `getObject`, `getObjectBuffer`, `objectExists`,
`deleteObject` and `getPresignedUploadUrl`.

## Optional: public S3 endpoint

Only needed if the browser must upload or download directly via presigned URLs.
Server-side uploads through the API do **not** need this.

1. On the `seaweedfs` service → **Domains** → **Add Domain**.
2. Host: `storage.yourdomain.com`, Service: `seaweedfs`, Port: `8333`,
   HTTPS on, certificate provider Let's Encrypt.
3. Point that DNS record at the server first, or the certificate will fail.
4. Tighten `SEAWEEDFS_ALLOWED_ORIGINS` from `*` to your frontend origin.
5. Set `S3_PUBLIC_ENDPOINT=https://storage.yourdomain.com` on the API.

If presigned URLs then return `SignatureDoesNotMatch`, Traefik is rewriting the
Host header. Set `SEAWEEDFS_EXTERNAL_URL` to the same public URL and redeploy.

## Backups

Everything lives in the `seaweedfs_data` Docker volume. Dokploy's built-in
**Backups** tab covers databases, not arbitrary volumes, so back this up with a
cron job on the host:

```bash
# /etc/cron.daily/seaweedfs-backup
docker run --rm \
  -v seaweedfs_seaweedfs_data:/data:ro \
  -v /var/backups/seaweedfs:/backup \
  alpine tar czf /backup/seaweedfs-$(date +\%F).tar.gz -C /data .
```

Confirm the real volume name first with `docker volume ls | grep seaweedfs`;
Dokploy prefixes it with the compose project name.

For a consistent snapshot, stop the container around the tar, or replicate to
off-site S3 with `weed filer.remote.sync`.

## Sizing and limits

- `SEAWEEDFS_MAX_FILE_SIZE_MB` (default 256) caps a single object.
- `SEAWEEDFS_VOLUME_SIZE_LIMIT_MB` (default 1024) is when the master rolls over
  to a new volume file. Smaller volumes are easier to back up and compact.
- `-volume.max=0` lets the volume count grow with free disk, so capacity is
  bounded by the host disk rather than a fixed number.

## Upgrading

The image is pinned to `chrislusf/seaweedfs:4.44`. Bump the tag in
`docker-compose.yml`, commit, and redeploy. Data in `seaweedfs_data` is
preserved across upgrades. Take a backup before a major version jump.

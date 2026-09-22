// deploy/tutor-spec.mjs — adds or replaces the tutor sidecar in a container app's spec.
// Used by `bash deploy/azure-setup.sh tutor`, following the flow the Azure docs give for
// multi-container apps and Azure Files volumes: `az containerapp show -o json` (stdin) -> this
// script -> a spec file (JSON is valid YAML) -> `az containerapp update --yaml <file>`.
//
//   az containerapp show -n precalc -g precalc-rg -o json | node deploy/tutor-spec.mjs \
//     --image ghcr.io/owner/precalc-tutor:<sha> --storage tutorlog \
//     --env TUTOR_PROVIDER=gemini --secret-env GEMINI_API_KEY=gemini-api-key ... > spec.json
//
// Only the tutor container and its volume change; every other container, the secrets list (names
// only: `show` never returns values, and the CLI fills them back in), ingress and scale stay as they
// are. No secret value ever passes through this script. The mount path is fixed here (not an
// argument) because Git Bash would rewrite a /path argument into a Windows path.
import { readFileSync } from 'node:fs'

const MOUNT = '/data/tutor-log'
const VOLUME = 'tutor-log'
// The share is mounted for the image's `node` user (uid/gid 1000), owner-only.
const MOUNT_OPTIONS = 'uid=1000,gid=1000,dir_mode=0750,file_mode=0640'

function die(msg) {
  process.stderr.write(`tutor-spec: ${msg}\n`)
  process.exit(1)
}

const args = process.argv.slice(2)
let image = ''
let storage = ''
const env = []
for (let i = 0; i < args.length; i++) {
  const a = args[i]
  const v = args[i + 1]
  if (v === undefined) die(`${a} needs a value`)
  i++
  if (a === '--image') image = v
  else if (a === '--storage') storage = v
  else if (a === '--env' || a === '--secret-env') {
    const eq = v.indexOf('=')
    if (eq < 1) die(`${a} wants NAME=value, got "${v}"`)
    const name = v.slice(0, eq)
    const value = v.slice(eq + 1)
    env.push(a === '--env' ? { name, value } : { name, secretRef: value })
  } else die(`unknown argument ${a}`)
}
if (!/^[a-z0-9.-]+\/[a-z0-9._/-]+:[A-Za-z0-9._-]+$/.test(image)) die(`--image looks wrong: "${image}"`)
if (!/^[A-Za-z0-9-]{1,32}$/.test(storage)) die(`--storage looks wrong: "${storage}"`)

let app
try {
  app = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  die('stdin is not the JSON of `az containerapp show -o json`')
}
const template = app?.properties?.template
if (!template || !Array.isArray(template.containers) || template.containers.length === 0) die('no properties.template.containers in the app JSON')

// A reused revision suffix would name the new revision like an existing one.
delete template.revisionSuffix

const others = template.containers.filter((c) => c.name !== 'tutor')
if (others.length === 0) die('the app has no web container')
const tutor = {
  name: 'tutor',
  image,
  resources: { cpu: 0.25, memory: '0.5Gi' },
  env: [...env, { name: 'TUTOR_LOG_DIR', value: MOUNT }],
  volumeMounts: [{ volumeName: VOLUME, mountPath: MOUNT }],
}
// The web container stays first: the setup script's other steps and the workflow look it up by name.
template.containers = [...others, tutor]
template.volumes = [
  ...(Array.isArray(template.volumes) ? template.volumes.filter((v) => v.name !== VOLUME) : []),
  { name: VOLUME, storageType: 'AzureFile', storageName: storage, mountOptions: MOUNT_OPTIONS },
]

process.stdout.write(JSON.stringify(app, null, 2) + '\n')

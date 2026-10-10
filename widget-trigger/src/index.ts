// Dispara el workflow `widget-data.yml` (que genera widget.json) cada 15 minutos.
// El cron propio de GitHub Actions es "best effort" y en este repo corría 4-6 veces por día;
// un workflow_dispatch por API se ejecuta enseguida.
//
// Secreto requerido (no está en el repo): GITHUB_TOKEN = token fine-grained con permiso
// "Actions: Read and write" SOLO sobre este repositorio.
//   npx wrangler secret put GITHUB_TOKEN

interface Env {
  GITHUB_TOKEN?: string;
}

const REPO = "Ignacio-81/commission-tracker";
const WORKFLOW = "widget-data.yml";
const REF = "main";

async function dispatch(env: Env): Promise<string> {
  if (!env.GITHUB_TOKEN) return "falta el secreto GITHUB_TOKEN";
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "commission-tracker-widget-trigger",
    },
    body: JSON.stringify({ ref: REF }),
  });
  // 204 = disparado. 401/403 = token vencido o sin permiso; 404 = repo/workflow mal escrito.
  return r.status === 204 ? "ok" : `GitHub respondió ${r.status}: ${(await r.text()).slice(0, 200)}`;
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      dispatch(env).then((res) => {
        if (res !== "ok") console.error("widget-trigger:", res);
      }),
    );
  },

  // Solo informativo: NO dispara nada desde afuera (evita que cualquiera pueda gatillar corridas).
  async fetch(): Promise<Response> {
    return new Response("commission-tracker-widget-trigger: dispara widget-data.yml cada 15 min (cron).\n");
  },
};

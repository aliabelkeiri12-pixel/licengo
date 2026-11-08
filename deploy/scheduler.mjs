// Planificateur sans dépendance (image node:22-alpine) : appelle les tâches LICENGO à heure fixe (Europe/Paris).
const BASE = process.env.APP_INTERNAL_URL ?? "http://web:3000";
const SECRET = process.env.CRON_SECRET;
if (!SECRET) { console.error("CRON_SECRET manquant"); process.exit(1); }
const jobs = [
  { name: "installments", path: "/api/cron/installments", at: process.env.CRON_INSTALLMENTS_AT ?? "06:15" },
  { name: "reminders", path: "/api/cron/reminders", at: process.env.CRON_REMINDERS_AT ?? "17:30" },
];
const last = new Map();
const parisNow = () => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
async function run(job) {
  try {
    const res = await fetch(BASE + job.path, { method: "POST", headers: { Authorization: `Bearer ${SECRET}` } });
    console.log(new Date().toISOString(), job.name, res.status, await res.text());
  } catch (e) { console.error(new Date().toISOString(), job.name, "échec", e.message); }
}
setInterval(() => {
  const p = Object.fromEntries(parisNow().map((x) => [x.type, x.value]));
  const hm = `${p.hour}:${p.minute}`, day = `${p.year}-${p.month}-${p.day}`;
  for (const j of jobs) if (j.at === hm && last.get(j.name) !== day) { last.set(j.name, day); run(j); }
}, 20_000);
if (process.argv.includes("--now")) jobs.forEach(run);
console.log("scheduler démarré", jobs.map((j) => `${j.name}@${j.at}`).join(", "));

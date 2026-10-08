/**
 * Step 2 — preserve the history held in two legacy tables inside their canonical tables.
 * Purely additive (INSERT ... ON CONFLICT DO NOTHING): nothing is changed or deleted, and
 * it can be run more than once.
 *
 *   node database/cleanup/02-copy-data.js            dry run
 *   node database/cleanup/02-copy-data.js --apply    commit
 *
 *   public.auditlogs              -> public.audit_logs    (332 CMS/booking/auth audit entries)
 *   public.notification_campaigns -> public.push_campaigns (3 broadcast campaigns, same ids, so the
 *                                    271 user_notifications rows that point at them stay valid)
 */
const { connect, redact } = require("../lib");

const APPLY = process.argv.includes("--apply");

(async () => {
  const c = await connect("tirvona-cleanup-02-copy");
  const n = async (sql, p) => Number((await c.query(sql, p)).rows[0].n);
  try {
    await c.query("BEGIN");

    // ---------------------------------------------------------------- audit logs
    const auditSource = await n("SELECT count(*) n FROM public.auditlogs");
    const auditBefore = await n("SELECT count(*) n FROM public.audit_logs");
    const missingKeys = await n("SELECT count(*) n FROM public.auditlogs WHERE action IS NULL OR module IS NULL");
    const idClash = await n("SELECT count(*) n FROM public.auditlogs a JOIN public.audit_logs b ON b.id = a.id");
    console.log(`audit: source ${auditSource}, target ${auditBefore}, rows already in target ${idClash}, rows missing action/module ${missingKeys}`);
    if (missingKeys) throw new Error("auditlogs has rows without action/module; they would be invalid in audit_logs");
    await c.query(`
      INSERT INTO public.audit_logs
        (id, _migrated_at, version, action, created_at, details, module, "timestamp", updated_at, user_id, _nulls, _extra, ip_address, user_agent)
      SELECT a.id, a._migrated_at, a.version, a.action, a.created_at, a.details, a.module,
             coalesce(a."timestamp", a.created_at), a.updated_at,
             CASE jsonb_typeof(a.user_id) WHEN 'string' THEN a.user_id #>> '{}' WHEN 'object' THEN a.user_id ->> '$oid' END,
             a._nulls, a._extra, a.ip_address, a.user_agent
      FROM public.auditlogs a
      ON CONFLICT (id) DO NOTHING`);
    const auditAfter = await n("SELECT count(*) n FROM public.audit_logs");
    const auditPresent = await n("SELECT count(*) n FROM public.auditlogs a WHERE EXISTS (SELECT 1 FROM public.audit_logs b WHERE b.id = a.id)");
    const auditWrongUser = await n(`SELECT count(*) n FROM public.auditlogs a JOIN public.audit_logs b ON b.id = a.id
        WHERE coalesce(b.user_id, '') IS DISTINCT FROM coalesce(CASE jsonb_typeof(a.user_id) WHEN 'string' THEN a.user_id #>> '{}' WHEN 'object' THEN a.user_id ->> '$oid' END, '')
           OR b.action IS DISTINCT FROM a.action OR b.module IS DISTINCT FROM a.module OR b.details IS DISTINCT FROM a.details OR b.created_at IS DISTINCT FROM a.created_at`);
    console.log(`audit: target now ${auditAfter}; ${auditPresent}/${auditSource} source rows present; ${auditWrongUser} field mismatches`);
    if (auditPresent !== auditSource || auditWrongUser) throw new Error("audit copy verification failed");

    // ------------------------------------------------------------ push campaigns
    const campSource = await n("SELECT count(*) n FROM public.notification_campaigns");
    const campBefore = await n("SELECT count(*) n FROM public.push_campaigns");
    const orphanBefore = await n(`SELECT count(*) n FROM public.user_notifications u WHERE u.campaign_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.push_campaigns p WHERE p.id = u.campaign_id)`);
    console.log(`campaigns: source ${campSource}, target ${campBefore}; user_notifications pointing at no campaign: ${orphanBefore}`);
    await c.query(`
      INSERT INTO public.push_campaigns
        (id, _migrated_at, version, audience_type, body, created_at, failed_count, image_url, recipient_count, sender_id,
         sent_count, status, target_ashram_ids, target_roles, target_user_ids, title, updated_at, _nulls, _extra, deep_link)
      SELECT o.id, o._migrated_at, o.version, o.audience_type, o.body, o.created_at, o.failure_count, o.image_url, o.recipient_count, o.sent_by,
             o.success_count, o.status, '[]'::jsonb, o.target_roles, o.target_user_ids, o.title, o.updated_at, o._nulls,
             jsonb_strip_nulls(coalesce(o._extra, '{}'::jsonb) || jsonb_build_object('sentAt', o.sent_at, 'failureReason', nullif(o.failure_reason, ''), 'migratedFrom', 'notification_campaigns')),
             o.deep_link
      FROM public.notification_campaigns o
      ON CONFLICT (id) DO NOTHING`);
    const campAfter = await n("SELECT count(*) n FROM public.push_campaigns");
    const campPresent = await n("SELECT count(*) n FROM public.notification_campaigns o WHERE EXISTS (SELECT 1 FROM public.push_campaigns p WHERE p.id = o.id)");
    const orphanAfter = await n(`SELECT count(*) n FROM public.user_notifications u WHERE u.campaign_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.push_campaigns p WHERE p.id = u.campaign_id)`);
    const linked = await n(`SELECT count(*) n FROM public.user_notifications u WHERE EXISTS (SELECT 1 FROM public.notification_campaigns o WHERE o.id = u.campaign_id)
        AND EXISTS (SELECT 1 FROM public.push_campaigns p WHERE p.id = u.campaign_id)`);
    const recipientMismatch = await n(`SELECT count(*) n FROM public.notification_campaigns o JOIN public.push_campaigns p ON p.id = o.id
        WHERE p.recipient_count IS DISTINCT FROM o.recipient_count OR p.title IS DISTINCT FROM o.title OR p.body IS DISTINCT FROM o.body OR p.sent_count IS DISTINCT FROM o.success_count`);
    console.log(`campaigns: target now ${campAfter}; ${campPresent}/${campSource} present; ${linked} user_notifications now resolve to them; orphans ${orphanBefore} -> ${orphanAfter}; mismatches ${recipientMismatch}`);
    if (campPresent !== campSource || orphanAfter !== 0 || recipientMismatch) throw new Error("campaign copy verification failed");

    if (APPLY) {
      await c.query("COMMIT");
      console.log("APPLIED and committed.");
    } else {
      await c.query("ROLLBACK");
      console.log("DRY RUN — rolled back. Re-run with --apply to commit.");
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});

/**
 * npm run db:duplicates — READ-ONLY report of records that look like the same
 * real-world entity once identifiers are normalised:
 *   - users sharing a phone number written in different formats
 *     ("+918920877101" / "08920877101" / "8920877101") or the same e-mail
 *   - WhatsApp customers sharing a phone number
 *   - lead rows with identical business identity (name + phone) created seconds apart
 * It never changes anything. Duplicate accounts are reported, not merged: an
 * account with bookings or payments must be merged by a person.
 */
const { connect, redact } = require("./lib");

const LAST10 = (col) => `right(regexp_replace(coalesce(${col}, ''), '\\D', '', 'g'), 10)`;

const CHECKS = [
  {
    title: "users: same phone number in different formats",
    sql: `select ${LAST10("phone")} as phone10, count(*) as accounts, string_agg(id || ' <' || email || '> ' || phone, '  |  ' order by created_at) as detail
          from public.users where length(${LAST10("phone")}) = 10 and coalesce(is_deleted, false) = false
          group by 1 having count(*) > 1 order by 2 desc`,
  },
  {
    title: "users: same e-mail ignoring case/whitespace",
    sql: `select lower(trim(email)) as email, count(*) as accounts, string_agg(id || ' ' || phone, '  |  ') as detail
          from public.users where coalesce(is_deleted, false) = false group by 1 having count(*) > 1`,
  },
  {
    title: "whatsapp_customers: same phone number in different formats",
    sql: `select ${LAST10("phone")} as phone10, count(*) as rows, string_agg(id, ', ') as detail
          from public.whatsapp_customers where length(${LAST10("phone")}) = 10 group by 1 having count(*) > 1`,
  },
  {
    title: "leads: identical name + phone created within 60 seconds of each other",
    sql: `select lower(regexp_replace(name, '\\s+', ' ', 'g')) as name, ${LAST10("contact->>'phone'")} as phone10, count(*) as rows,
                 to_char(min(created_at), 'YYYY-MM-DD HH24:MI:SS') as first_at, to_char(max(created_at), 'YYYY-MM-DD HH24:MI:SS') as last_at
          from leads.leads group by 1, 2
          having count(*) > 1 and max(created_at) - min(created_at) < interval '60 seconds' order by 3 desc`,
  },
];

(async () => {
  const c = await connect("tirvona-db-duplicates");
  try {
    await c.query("BEGIN READ ONLY");
    let found = 0;
    for (const check of CHECKS) {
      const rows = (await c.query(check.sql)).rows;
      console.log(`\n${check.title}: ${rows.length} group(s)`);
      for (const r of rows) console.log("  ", JSON.stringify(r));
      found += rows.length;
    }
    await c.query("ROLLBACK");
    console.log(found ? `\n${found} duplicate group(s) need a person to review them.` : "\nNo duplicates found.");
    process.exitCode = found ? 2 : 0;
  } finally {
    await c.end();
  }
})().catch((e) => {
  console.error("FAILED:", redact(e && e.message ? e.message : e));
  process.exit(1);
});

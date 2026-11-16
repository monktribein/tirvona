# Separate issue (not Yatra): invalid HTML nesting on the Pandit Withdrawals admin page

**Status: reported only. Not fixed, by instruction. Outside the Yatra scope.**

| | |
|---|---|
| Page | `/admin/pandits/withdrawals` (Super Admin, Finance Manager, Service Manager, HR, Executive) |
| File | `frontend/src/modules/pandit/admin/AdminPanditWithdrawalsPage.tsx`, line 179 |
| Last changed | about 5 weeks ago; not touched by the Yatra work or the payment fixes |
| Found by | the dark-deploy regression smoke (Yatra flags off), twice, with the same result |
| Symptom | While the totals load, React logs: "In HTML, `<div>` cannot be a descendant of `<p>`. This will cause a hydration error." The page still renders and works. |
| Cause | `<p className="mt-1 text-xl …">{t.value ?? <Skeleton className="h-6 w-20" />}</p>`: the loading `Skeleton` renders a `<div>` inside a `<p>`. |
| Impact | Console error only; no data or money impact. Browsers repair the DOM. This admin page is private and rendered only in the browser (the SEO renderer does not serve it), so no hydration happens here. |
| Suggested fix (when approved) | Change that `<p>` to a `<div>` with the same classes (one line), then run frontend lint and build. |
| Risk of the fix | Very low (markup only) |

Waiting for the owner to decide whether and when to fix it, as a separate change.

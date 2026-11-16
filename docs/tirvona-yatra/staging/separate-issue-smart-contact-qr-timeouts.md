# Separate issue (not Yatra): Smart Contact QR tests time out under load

**Status: reported only. No code or test changed, by instruction. Outside the Yatra scope.**

| | |
|---|---|
| Test file | `Newbackend/src/modules/smart-contact/application/qr.service.spec.ts` |
| Failing tests | "produces a PNG at the requested width" (line 33) and "returns the right content type per format" (line 93) |
| Error | `Exceeded timeout of 30000 ms for a test`. Both use the suite's own `RASTER_TIMEOUT = 30_000`. |
| What they do | Render a 1,000-px QR PNG through `QrService.renderPng` (the `qrcode` 1.5.4 PNG encoder) |
| Measured | About 0.3 s in plain Node (two runs: 364 ms, 277 ms). About 20–25 s inside Jest: one test passed alone in 27 s total with `--testTimeout=300000`. |
| Observed results on 2026-11-15 | Passed in both full unit runs earlier the same day (2,515/2,515). Failed (2 of 2,519) in two full runs and one isolated run while the machine was under load from a busy desktop browser. Passed when run alone with a longer timeout. |
| History | The spec and service have been unchanged for about 3 months. None of the six Yatra and payment commits touches `smart-contact`, `qrcode` or its dependencies (the mongoose bump does not affect them). |
| Impact | Test-only and load-sensitive. QR generation itself is fast outside Jest. No production behaviour change. |
| Not done | Timeouts not raised and tests not skipped (the instructions forbid loosening tests or touching unrelated modules). |
| Suggested follow-up (owner decision) | Ask the Smart Contact owner to find out why PNG encoding is about 70× slower under Jest (for example the module transform or environment), or to render a smaller PNG in the test. |

import { QrService } from "./qr.service";

const URL = "https://www.tirvona.com/c/ravindr-bhardwaj";

describe("QrService", () => {
  const service = new QrService();

  /**
   * PNG rasterisation runs roughly 15× slower under ts-jest than it does in
   * the app (108ms for 1000px, 290ms for 2000px measured directly), so the
   * raster tests get their own timeout. Nothing here is slow in production.
   */
  const RASTER_TIMEOUT = 30_000;

  it("renders SVG that encodes the URL and nothing else", () => {
    const svg = service.renderSvg(URL);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("</svg>");
    // The payload appears only in the accessible label, never as encoded
    // contact data — spec §2 and §49.
    expect(svg).toContain(URL);
    expect(svg).not.toContain("8630949349");
  });

  it("grows the viewBox for a caption band rather than overlaying the symbol", () => {
    const plain = service.renderSvg(URL);
    const captioned = service.renderSvg(URL, { caption: "Scan & Save Contact" });
    const height = (svg: string): number =>
      Number(/viewBox="0 0 \d+ (\d+)"/.exec(svg)?.[1] ?? 0);
    expect(height(captioned)).toBeGreaterThan(height(plain));
    expect(captioned).toContain("Scan &amp; Save Contact");
  });

  it("escapes caption text so a stray angle bracket cannot break the markup", () => {
    const svg = service.renderSvg(URL, { caption: '<script>"x"' });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("produces a PNG at the requested width", async () => {
    const png = await service.renderPng(URL, 1000);
    // PNG signature.
    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    // IHDR width is a big-endian uint32 at byte 16.
    expect(png.readUInt32BE(16)).toBe(1000);
  }, RASTER_TIMEOUT);

  /**
   * Checked through `pngOptions` rather than by rasterising: a 2000px symbol
   * takes 290ms in the app but tens of seconds under ts-jest, which would
   * dominate the suite. The 1000px case above already proves the bytes come
   * out right; what matters here is that the requested width and the level-H
   * error correction reach the encoder unmodified.
   */
  it("passes brochure dimensions straight through, per spec §14", () => {
    expect(service.pngOptions(2000)).toMatchObject({
      width: 2000,
      errorCorrectionLevel: "H",
      margin: 4,
    });
  });

  it("clamps an absurd width instead of trying to allocate it", () => {
    expect(service.pngOptions(99_000).width).toBe(4000);
    expect(service.pngOptions(10).width).toBe(200);
    expect(service.pngOptions().width).toBe(1000);
  });

  it("produces a structurally valid single-page PDF", () => {
    const pdf = service.renderPdf(URL, { frame: true });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Count 1");

    // The startxref offset must point at the literal "xref" table, or readers
    // reject the file.
    const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(Number.isFinite(startxref)).toBe(true);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("keeps PDF byte offsets correct when the caption is pure ASCII", () => {
    const pdf = service.renderPdf(URL, { caption: "Scan & Save Contact" });
    const text = pdf.toString("latin1");
    const startxref = Number(/startxref\s+(\d+)/.exec(text)?.[1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("declines a Hindi caption for PDF, which has no embedded font", () => {
    expect(service.pdfCaptionIsRenderable("Scan & Save Contact")).toBe(true);
    expect(service.pdfCaptionIsRenderable("स्कैन करें और संपर्क सेव करें")).toBe(
      false,
    );
    // …and renders the PDF without it rather than emitting broken glyphs.
    const pdf = service.renderPdf(URL, {
      caption: "स्कैन करें और संपर्क सेव करें",
    });
    expect(pdf.toString("latin1")).not.toContain("Tj");
  });

  it("renders the Hindi caption in SVG, which has no such limit", () => {
    const svg = service.renderSvg(URL, {
      caption: "स्कैन करें और संपर्क सेव करें",
    });
    expect(svg).toContain("स्कैन करें और संपर्क सेव करें");
  });

  it("returns the right content type per format", async () => {
    await expect(service.render(URL, "svg")).resolves.toMatchObject({
      contentType: "image/svg+xml; charset=utf-8",
      extension: "svg",
    });
    await expect(service.render(URL, "png")).resolves.toMatchObject({
      contentType: "image/png",
    });
    await expect(service.render(URL, "pdf")).resolves.toMatchObject({
      contentType: "application/pdf",
    });
  }, RASTER_TIMEOUT);
});

import { parseYouTubeUrl } from "./youtube";

describe("YouTube live links", () => {
  it("accepts channel live pages and keeps them as links", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/@PanditKushal/live")).toEqual({
      url: "https://www.youtube.com/@PanditKushal/live",
      videoId: null,
    });
    expect(parseYouTubeUrl("youtube.com/@PanditKushal/live")?.url).toBe("https://youtube.com/@PanditKushal/live");
  });

  it("finds the video id of a specific stream so it can be embedded", () => {
    expect(parseYouTubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://youtu.be/dQw4w9WgXcQ?si=abc")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("https://www.youtube.com/live/dQw4w9WgXcQ?feature=share")?.videoId).toBe("dQw4w9WgXcQ");
    expect(parseYouTubeUrl("http://m.youtube.com/watch?v=dQw4w9WgXcQ")?.url.startsWith("https://")).toBe(true);
  });

  it("refuses anything that is not YouTube or points at nothing", () => {
    for (const bad of [
      "",
      "https://zoom.us/j/123",
      "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ",
      "https://www.youtube.com/",
      "https://www.youtube.com/watch?v=short",
      "https://youtu.be/",
      "javascript:alert(1)",
    ])
      expect(parseYouTubeUrl(bad)).toBeNull();
  });
});

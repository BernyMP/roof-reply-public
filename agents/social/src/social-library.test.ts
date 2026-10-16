import test from "node:test";
import assert from "node:assert/strict";
import {
  SOCIAL_LIBRARY,
  selectLibraryContent,
  LIBRARY_REVIEWED_SOURCE_VERSION,
} from "./social-library.ts";
import {
  SOCIAL_TOPICS,
  socialSourceVersion,
  validateContent,
  captionFor,
  topicForDate,
  SOCIAL_SOURCES,
} from "./social-content.ts";

test("all prepared posts are valid and reviewed against current marketing sources", () => {
  assert.equal(SOCIAL_LIBRARY.length, 40);
  assert.equal(LIBRARY_REVIEWED_SOURCE_VERSION, socialSourceVersion());
  for (const topic of SOCIAL_TOPICS)
    assert.equal(SOCIAL_LIBRARY.filter((c) => c.topic === topic).length, 8);
  for (const card of SOCIAL_LIBRARY) {
    validateContent(card);
    assert.ok(captionFor(card, "instagram", "sample").length <= 2200);
  }
});

test("library rotates for a year without repeating a hook inside 30 days", () => {
  const history: string[] = [];
  for (let day = 0; day < 365; day++) {
    const date = new Date(Date.UTC(2026, 0, 1 + day))
      .toISOString()
      .slice(0, 10);
    const content = selectLibraryContent(date, history.slice(-30));
    assert.equal(content.topic, topicForDate(date));
    validateContent(content, history.slice(-30));
    history.push(content.hook);
  }
});

test("library exhaustion stops without a paid fallback", () => {
  assert.throws(
    () =>
      selectLibraryContent(
        "2026-09-14",
        SOCIAL_LIBRARY.map((c) => c.hook),
      ),
    /No unused/,
  );
});

test("marketing changes require a library review", () => {
  const original = SOCIAL_SOURCES.promise;
  try {
    SOCIAL_SOURCES.promise = "Changed offer";
    assert.throws(
      () => selectLibraryContent("2026-09-14"),
      /Marketing sources changed/,
    );
  } finally {
    SOCIAL_SOURCES.promise = original;
  }
});

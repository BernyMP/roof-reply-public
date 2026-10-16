import test from "node:test";
import assert from "node:assert/strict";
import { generateSocialContent } from "./social-ai.ts";
import { SAMPLE_CONTENT } from "./social-content.ts";

test("content generation requires valid structured content and a separate source review", async () => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  const calls: any[] = [];
  try {
    const result = await generateSocialContent(
      "missed_calls",
      [],
      undefined,
      async (_url, init) => {
        calls.push(JSON.parse(String(init?.body)));
        return Response.json({
          choices: [
            {
              finish_reason: "stop",
              message: {
                content: JSON.stringify(
                  calls.length === 1
                    ? SAMPLE_CONTENT
                    : {
                        approved: true,
                        reason: "Supported by source material.",
                      },
                ),
              },
            },
          ],
        });
      },
    );
    assert.deepEqual(result, SAMPLE_CONTENT);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].response_format.json_schema.strict, true);
    assert.equal(
      calls[1].response_format.json_schema.name,
      "roofreply_social_review",
    );
    assert.equal(calls[0].model, "gpt-4o-mini");
  } finally {
    if (prior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prior;
  }
});
test("rejected source review prevents publication-ready content", async () => {
  const prior = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "test-only";
  let calls = 0;
  try {
    await assert.rejects(
      () =>
        generateSocialContent("missed_calls", [], undefined, async () => {
          calls++;
          return Response.json({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify(
                    calls === 1
                      ? SAMPLE_CONTENT
                      : { approved: false, reason: "Unsupported." },
                  ),
                },
              },
            ],
          });
        }),
      /review rejected/,
    );
  } finally {
    if (prior === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prior;
  }
});

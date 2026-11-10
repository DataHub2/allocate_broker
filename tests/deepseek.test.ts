import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AiFailure, deepSeekAi, type AiJobContext } from "@/lib/ai";

let server: Server;
let baseURL = "";
let replies: string[] = [];
let requests: { messages: { role: string; content: string | { type: string; text?: string; image_url?: { url: string } }[] }[]; model: string; response_format: { type: string } }[] = [];

const valid = { title: "Badrum", job_types: ["badrum"], prefilled: [], extra_questions: [] };
const job: AiJobContext = {
  description: "Nytt badrum", facts: { Ort: "Nacka" }, answers: [],
  files: [
    { kind: "photo", mime: "image/jpeg", data: new Uint8Array([1, 2, 3]), task: "Golvbrunnen" },
    { kind: "drawing", mime: "application/pdf", data: new Uint8Array([4]), task: null },
  ],
};

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push(JSON.parse(body));
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ id: "x", object: "chat.completion", created: 0, model: "deepseek-flash", choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content: replies.shift() ?? "" } }] }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseURL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => { server.close(); });
beforeEach(() => { replies = []; requests = []; });

describe("DeepSeek", () => {
  it("sends photos, asks for JSON and returns the parsed answer", async () => {
    replies = [JSON.stringify(valid)];
    const result = await deepSeekAi({ apiKey: "test", baseURL }).intake(job);
    expect(result.title).toBe("Badrum");
    const [request] = requests;
    expect(request.model).toBe("deepseek-flash");
    expect(request.response_format.type).toBe("json_object");
    expect(String(request.messages[0].content)).toMatch(/json/i);
    const parts = request.messages[1].content as { type: string; image_url?: { url: string } }[];
    expect(parts[0].image_url?.url).toBe("data:image/jpeg;base64,AQID");
    expect(parts.filter((p) => p.type === "image_url")).toHaveLength(1);
  });

  it("retries once on a blank answer, which JSON mode can return", async () => {
    replies = ["   ", JSON.stringify(valid)];
    await expect(deepSeekAi({ apiKey: "test", baseURL }).intake(job)).resolves.toMatchObject({ title: "Badrum" });
    expect(requests).toHaveLength(2);
  });

  it("fails clearly when the answer has the wrong shape twice", async () => {
    replies = [JSON.stringify({ title: 3 }), JSON.stringify({ nope: true })];
    await expect(deepSeekAi({ apiKey: "test", baseURL }).intake(job)).rejects.toBeInstanceOf(AiFailure);
  });
});

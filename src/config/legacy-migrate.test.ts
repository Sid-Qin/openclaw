import { describe, expect, it } from "vitest";
import { migrateLegacyConfig } from "./legacy-migrate.js";

describe("legacy migrate audio transcription", () => {
  it("moves routing.transcribeAudio into tools.media.audio.models", () => {
    const res = migrateLegacyConfig({
      routing: {
        transcribeAudio: {
          command: ["whisper", "--model", "base"],
          timeoutSeconds: 2,
        },
      },
    });

    expect(res.changes).toContain("Moved routing.transcribeAudio → tools.media.audio.models.");
    expect(res.config?.tools?.media?.audio).toEqual({
      enabled: true,
      models: [
        {
          command: "whisper",
          type: "cli",
          args: ["--model", "base"],
          timeoutSeconds: 2,
        },
      ],
    });
    expect((res.config as { routing?: unknown } | null)?.routing).toBeUndefined();
  });

  it("keeps existing tools media model and drops legacy routing value", () => {
    const res = migrateLegacyConfig({
      routing: {
        transcribeAudio: {
          command: ["whisper", "--model", "tiny"],
        },
      },
      tools: {
        media: {
          audio: {
            models: [{ command: "existing", type: "cli" }],
          },
        },
      },
    });

    expect(res.changes).toContain(
      "Removed routing.transcribeAudio (tools.media.audio.models already set).",
    );
    expect(res.config?.tools?.media?.audio?.models).toEqual([{ command: "existing", type: "cli" }]);
    expect((res.config as { routing?: unknown } | null)?.routing).toBeUndefined();
  });

  it("drops invalid audio.transcription payloads", () => {
    const res = migrateLegacyConfig({
      audio: {
        transcription: {
          command: [{}],
        },
      },
    });

    expect(res.changes).toContain("Removed audio.transcription (invalid or empty command).");
    expect(res.config?.audio).toBeUndefined();
    expect(res.config?.tools?.media?.audio).toBeUndefined();
  });
});

describe("legacy migrate mention routing", () => {
  it("moves routing.groupChat.requireMention into channel group defaults", () => {
    const res = migrateLegacyConfig({
      routing: {
        groupChat: {
          requireMention: true,
        },
      },
    });

    expect(res.changes).toContain(
      'Moved routing.groupChat.requireMention → channels.telegram.groups."*".requireMention.',
    );
    expect(res.changes).toContain(
      'Moved routing.groupChat.requireMention → channels.imessage.groups."*".requireMention.',
    );
    expect(res.config?.channels?.telegram?.groups?.["*"]?.requireMention).toBe(true);
    expect(res.config?.channels?.imessage?.groups?.["*"]?.requireMention).toBe(true);
    expect((res.config as { routing?: unknown } | null)?.routing).toBeUndefined();
  });

  it("moves channels.telegram.requireMention into groups.*.requireMention", () => {
    const res = migrateLegacyConfig({
      channels: {
        telegram: {
          requireMention: false,
        },
      },
    });

    expect(res.changes).toContain(
      'Moved telegram.requireMention → channels.telegram.groups."*".requireMention.',
    );
    expect(res.config?.channels?.telegram?.groups?.["*"]?.requireMention).toBe(false);
    expect(
      (res.config?.channels?.telegram as { requireMention?: unknown } | undefined)?.requireMention,
    ).toBeUndefined();
  });
});

describe("legacy migrate model/provider layout", () => {
  it("migrates defaultModel, providers, and legacy top-level model map", () => {
    const res = migrateLegacyConfig({
      defaultModel: "xai/grok-4-fast",
      providers: {
        ollama: {
          url: "http://10.0.0.50:11434",
          models: ["qwen:7b", "qwen3:8b"],
        },
      },
      models: {
        "ollama/qwen:7b": {
          provider: "ollama",
          model: "qwen:7b",
          url: "http://10.0.0.50:11434",
        },
      },
    });

    expect(res.config).not.toBeNull();
    expect(res.changes).toContain("Moved defaultModel → agents.defaults.model.primary.");
    expect(res.changes).toContain("Moved providers → models.providers.");
    expect(res.changes).toContain(
      "Moved legacy models.<provider/model> entries → agents.defaults.models.",
    );

    expect(res.config?.agents?.defaults?.model).toEqual({
      primary: "xai/grok-4-fast",
      fallbacks: [],
    });
    expect(res.config?.agents?.defaults?.models).toMatchObject({
      "ollama/qwen:7b": {},
      "ollama/qwen3:8b": {},
    });
    expect(res.config?.models?.providers?.ollama?.baseUrl).toBe("http://10.0.0.50:11434");
    expect(res.config?.models?.providers?.ollama?.models.map((item) => item.id)).toEqual([
      "qwen:7b",
      "qwen3:8b",
    ]);
  });
});

describe("legacy migrate controlUi", () => {
  it("moves top-level controlUi into gateway.controlUi", () => {
    const res = migrateLegacyConfig({
      controlUi: {
        enabled: true,
        allowInsecureAuth: true,
      },
    });

    expect(res.config).not.toBeNull();
    expect(res.changes).toContain("Moved controlUi → gateway.controlUi.");
    expect(res.config?.gateway?.controlUi).toMatchObject({
      enabled: true,
      allowInsecureAuth: true,
    });
  });
});

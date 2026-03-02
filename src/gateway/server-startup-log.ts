import chalk from "chalk";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../agents/defaults.js";
import { resolveConfiguredModelRef } from "../agents/model-selection.js";
import { resolveSandboxConfigForAgent } from "../agents/sandbox.js";
import type { OpenClawConfig, loadConfig } from "../config/config.js";
import { getResolvedLoggerSettings } from "../logging.js";
import { collectEnabledInsecureOrDangerousFlags } from "../security/dangerous-config-flags.js";

export function logGatewayStartup(params: {
  cfg: ReturnType<typeof loadConfig>;
  bindHost: string;
  bindHosts?: string[];
  port: number;
  tlsEnabled?: boolean;
  log: { info: (msg: string, meta?: Record<string, unknown>) => void; warn: (msg: string) => void };
  isNixMode: boolean;
}) {
  const { provider: agentProvider, model: agentModel } = resolveConfiguredModelRef({
    cfg: params.cfg,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  const modelRef = `${agentProvider}/${agentModel}`;
  params.log.info(`agent model: ${modelRef}`, {
    consoleMessage: `agent model: ${chalk.whiteBright(modelRef)}`,
  });
  const scheme = params.tlsEnabled ? "wss" : "ws";
  const formatHost = (host: string) => (host.includes(":") ? `[${host}]` : host);
  const hosts =
    params.bindHosts && params.bindHosts.length > 0 ? params.bindHosts : [params.bindHost];
  const listenEndpoints = hosts.map((host) => `${scheme}://${formatHost(host)}:${params.port}`);
  params.log.info(`listening on ${listenEndpoints.join(", ")} (PID ${process.pid})`);
  params.log.info(`log file: ${getResolvedLoggerSettings().file}`);
  if (params.isNixMode) {
    params.log.info("gateway: running in Nix mode (config managed externally)");
  }

  const enabledDangerousFlags = collectEnabledInsecureOrDangerousFlags(params.cfg);
  if (enabledDangerousFlags.length > 0) {
    const warning =
      `security warning: dangerous config flags enabled: ${enabledDangerousFlags.join(", ")}. ` +
      "Run `openclaw security audit`.";
    params.log.warn(warning);
  }

  for (const conflict of collectConfigConflicts(params.cfg)) {
    params.log.warn(conflict);
  }
}

/**
 * Detect semantic conflicts between layered security/exec config options that
 * would silently override each other at runtime.
 */
export function collectConfigConflicts(cfg: OpenClawConfig): string[] {
  const conflicts: string[] = [];

  const execAsk = cfg.tools?.exec?.ask;
  const execSecurity = cfg.tools?.exec?.security;
  const execHost = cfg.tools?.exec?.host;
  const sandboxCfg = resolveSandboxConfigForAgent(cfg);
  const sandboxMode = sandboxCfg.mode;

  if (execAsk === "off" && sandboxMode === "non-main") {
    conflicts.push(
      'tools.exec.ask is "off" but agents.defaults.sandbox.mode is "non-main". ' +
        "Exec commands from channel sessions (Telegram, Discord, etc.) will still require approval via sandbox. " +
        'To allow exec without approval, set agents.defaults.sandbox.mode to "off".',
    );
  }

  if (execAsk === "off" && sandboxMode === "all") {
    conflicts.push(
      'tools.exec.ask is "off" but agents.defaults.sandbox.mode is "all". ' +
        "Sandbox overrides ask mode for all sessions, including main. " +
        'To allow exec without approval, set agents.defaults.sandbox.mode to "off".',
    );
  }

  if (execSecurity === "full" && sandboxMode !== "off") {
    conflicts.push(
      `tools.exec.security is "full" but agents.defaults.sandbox.mode is "${sandboxMode}". ` +
        "Sandbox approval will override full-security exec for affected sessions. " +
        'Set agents.defaults.sandbox.mode to "off" if you intend unrestricted exec.',
    );
  }

  if (execHost === "gateway" && sandboxMode === "non-main") {
    conflicts.push(
      'tools.exec.host is "gateway" but agents.defaults.sandbox.mode is "non-main". ' +
        "Non-main sessions will still route exec through sandbox despite the gateway host setting. " +
        'Set sandbox.mode to "off" to bypass sandbox routing.',
    );
  }

  return conflicts;
}

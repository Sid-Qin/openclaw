const ANSI_CSI_PATTERN = "\\x1b\\[[0-?]*[ -/]*[@-~]";
// Generic OSC sequence: ESC ] ... BEL or ESC \\
const ANSI_OSC_PATTERN = "\\x1b\\][^\\x07\\x1b]*(?:\\x07|\\x1b\\\\)";
const ANSI_REGEX = new RegExp(`${ANSI_CSI_PATTERN}|${ANSI_OSC_PATTERN}`, "g");

export function stripAnsi(input: string): string {
  return input.replace(ANSI_REGEX, "");
}

export function visibleWidth(input: string): number {
  return Array.from(stripAnsi(input)).length;
}

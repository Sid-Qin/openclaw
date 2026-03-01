import { theme } from "../theme/theme.js";
import { sanitizeRenderableText } from "../tui-formatters.js";
import { MarkdownMessageComponent } from "./markdown-message.js";

export class UserMessageComponent extends MarkdownMessageComponent {
  constructor(text: string) {
    super(sanitizeRenderableText(text), 1, {
      bgColor: (line) => theme.userBg(line),
      color: (line) => theme.userText(line),
    });
  }
}

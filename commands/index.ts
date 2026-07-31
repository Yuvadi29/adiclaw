import { CommandRegistry } from "./registry";

export const registry = new CommandRegistry();

// Register all built-in commands
import { helpCommand } from "./help";
import { exitCommand } from "./exit";
import { clearCommand } from "./clear";
import { statusCommand } from "./status";

registry.register(helpCommand);
registry.register(exitCommand);
registry.register(clearCommand);
registry.register(statusCommand);
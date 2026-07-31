import { CommandRegistry } from "./registry";

export const registry = new CommandRegistry();

// Built-in commands
import { helpCommand } from "./help";
import { exitCommand } from "./exit";
import { clearCommand } from "./clear";
import { statusCommand } from "./status";
import { modelCommand } from "./model";

// Mode commands
import { agentCommand } from "./agent";
import { askCommand } from "./ask";
import { planCommand } from "./plan";

registry.register(helpCommand);
registry.register(modelCommand);
registry.register(agentCommand);
registry.register(askCommand);
registry.register(planCommand);
registry.register(statusCommand);
registry.register(clearCommand);
registry.register(exitCommand);
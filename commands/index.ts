import { registry } from "./registry";

export { registry };


// Built-in commands
import { helpCommand } from "./help";
import { exitCommand } from "./exit";
import { clearCommand } from "./clear";
import { statusCommand } from "./status";
import { modelCommand } from "./model";
import { inferenceCommand } from "./inference";

// Mode commands
import { agentCommand } from "./agent";
import { askCommand } from "./ask";
import { planCommand } from "./plan";
import { youtubeCommand } from "./youtube";

registry.register(helpCommand);
registry.register(modelCommand);
registry.register(inferenceCommand);
registry.register(youtubeCommand);
registry.register(agentCommand);
registry.register(askCommand);
registry.register(planCommand);
registry.register(statusCommand);
registry.register(clearCommand);
registry.register(exitCommand);
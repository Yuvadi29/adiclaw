import { tasks } from "@clack/prompts";

async function run() {
    await tasks([
        {
            title: "Step 1: Install Dependencies",
            task: async (message) => {
                message("Running npm install...");
                await new Promise(r => setTimeout(r, 1000));
                message("Running postinstall...");
                await new Promise(r => setTimeout(r, 1000));
                return "Installed successfully";
            }
        },
        {
            title: "Step 2: Build Project",
            task: async (message) => {
                message("Compiling TypeScript...");
                await new Promise(r => setTimeout(r, 2000));
                return "Built successfully";
            }
        }
    ]);
}

run();

import chalk from "chalk";
import { spinner } from "@clack/prompts";

export class ActivityRenderer {
    private s = spinner();
    private isBusy = false;
    private started = false;
    private provider = "";
    private model = "";

    start(message?: string) {
        if (this.started) return;
        this.started = true;
        this.isBusy = true;
        this.s.start(chalk.bold(message ?? "Thinking..."));
    }

    update(message: string) {
        this.isBusy = true;
        if (this.started) {
            this.s.message(chalk.cyan(message));
        }
    }

    success(message: string) {
        this.isBusy = false;
        if (this.started) {
            this.s.message(chalk.green(`✔ ${message}`));
        }
    }

    done(message?: string) {
        this.isBusy = false;
        if (this.started && message) {
            this.s.message(chalk.gray(message));
        }
    }

    fail(message: string) {
        this.isBusy = false;
        if (this.started) {
            this.s.message(chalk.red(`✖ ${message}`));
        }
    }

    stop(finalMessage?: string) {
        if (!this.started) return;
        this.started = false;
        this.isBusy = false;
        this.s.stop(finalMessage ? chalk.green(`✔ ${finalMessage}`) : undefined);
    }

    setSession(provider: string, model: string) {
        this.provider = provider;
        this.model = model;
    }
}

export const activity = new ActivityRenderer();
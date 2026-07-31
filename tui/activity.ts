import chalk from "chalk";
import { spinner } from "@clack/prompts";

export class ActivityRenderer {
    [x: string]: any;
    private s = spinner();
    private _isBusy = false;
    private started = false;
    private provider = "";
    private model = "";

    get isBusy() { return this._isBusy; }

    start(message?: string) {
        if (this.started) return;
        this.started = true;
        this._isBusy = true;
        this.s.start(chalk.bold(message ?? "Thinking..."));
    }

    update(message: string) {
        this._isBusy = true;
        if (this.started) {
            this.s.message(chalk.cyan(message));
        }
    }

    success(message: string) {
        this._isBusy = false;
        if (this.started) {
            this.s.message(chalk.green(`✔ ${message}`));
        }
    }

    done(message?: string) {
        this._isBusy = false;
        if (this.started && message) {
            this.s.message(chalk.gray(message));
        }
    }

    fail(message: string) {
        this._isBusy = false;
        if (this.started) {
            this.s.message(chalk.red(`✖ ${message}`));
        }
    }

    stop(finalMessage?: string) {
        if (!this.started) return;
        this.started = false;
        this._isBusy = false;
        this.s.stop(finalMessage ? chalk.green(`✔ ${finalMessage}`) : undefined);
    }

    setSession(provider: string, model: string) {
        this.provider = provider;
        this.model = model;
    }
}

export const activity = new ActivityRenderer();
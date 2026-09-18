export interface ActivityEventData {
    message: string;
    toolName?: string;
    args?: any;
    durationMs?: number;
    category?: string;
    isSilent?: boolean;
}

export type ActivityListener = (message: string, data?: ActivityEventData) => void;

class ActivityEvents {
    private startListeners: ActivityListener[] = [];
    private finishListeners: ActivityListener[] = [];
    private silentFinishListeners: ActivityListener[] = [];
    private failListeners: ActivityListener[] = [];

    clear() {
        this.startListeners = [];
        this.finishListeners = [];
        this.silentFinishListeners = [];
        this.failListeners = [];
    }

    onStart(fn: ActivityListener) {
        this.startListeners.push(fn);
    }

    onFinish(fn: ActivityListener) {
        this.finishListeners.push(fn);
    }

    onSilentFinish(fn: ActivityListener) {
        this.silentFinishListeners.push(fn);
    }

    onFail(fn: ActivityListener) {
        this.failListeners.push(fn);
    }

    start(msgOrData: string | ActivityEventData) {
        const msg = typeof msgOrData === "string" ? msgOrData : msgOrData.message;
        const data = typeof msgOrData === "string" ? { message: msgOrData } : msgOrData;
        this.startListeners.forEach(l => l(msg, data));
    }

    finish(msgOrData: string | ActivityEventData) {
        const msg = typeof msgOrData === "string" ? msgOrData : msgOrData.message;
        const data = typeof msgOrData === "string" ? { message: msgOrData } : msgOrData;
        this.finishListeners.forEach(l => l(msg, data));
    }

    silentFinish(msgOrData: string | ActivityEventData) {
        const msg = typeof msgOrData === "string" ? msgOrData : msgOrData.message;
        const data = typeof msgOrData === "string" ? { message: msgOrData } : msgOrData;
        this.silentFinishListeners.forEach(l => l(msg, data));
    }

    fail(msgOrData: string | ActivityEventData) {
        const msg = typeof msgOrData === "string" ? msgOrData : msgOrData.message;
        const data = typeof msgOrData === "string" ? { message: msgOrData } : msgOrData;
        this.failListeners.forEach(l => l(msg, data));
    }
}

export const activityEvents = new ActivityEvents();
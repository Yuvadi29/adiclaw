type Listener = (message: string) => void;

class ActivityEvents {
    private startListeners: Listener[] = [];
    private finishListeners: Listener[] = [];
    private silentFinishListeners: Listener[] = [];
    private failListeners: Listener[] = [];

    clear() {
        this.startListeners = [];
        this.finishListeners = [];
        this.silentFinishListeners = [];
        this.failListeners = [];
    }

    onStart(fn: Listener) {
        this.startListeners.push(fn);
    }

    onFinish(fn: Listener) {
        this.finishListeners.push(fn);
    }

    onSilentFinish(fn: Listener) {
        this.silentFinishListeners.push(fn);
    }

    onFail(fn: Listener) {
        this.failListeners.push(fn);
    }

    start(msg: string) {
        this.startListeners.forEach(l => l(msg));
    }

    finish(msg: string) {
        this.finishListeners.forEach(l => l(msg));
    }

    silentFinish(msg: string) {
        this.silentFinishListeners.forEach(l => l(msg));
    }

    fail(msg: string) {
        this.failListeners.forEach(l => l(msg));
    }
}

export const activityEvents = new ActivityEvents();
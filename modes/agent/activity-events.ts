type Listener = (message: string) => void;

class ActivityEvents {
    private startListeners: Listener[] = [];
    private finishListeners: Listener[] = [];
    private failListeners: Listener[] = [];

    onStart(fn: Listener) {
        this.startListeners.push(fn);
    }

    onFinish(fn: Listener) {
        this.finishListeners.push(fn);
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

    fail(msg: string) {
        this.failListeners.forEach(l => l(msg));
    }
}

export const activityEvents = new ActivityEvents();
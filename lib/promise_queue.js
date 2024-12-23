class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}

class PromiseQueue {
    constructor(concurrency = 1, timeout = 5000) {
        this.concurrency = concurrency;
        this.timeout = timeout;
        this.queue = [];
        this.activeCount = 0;
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            const wrappedTask = () => {
                const timer = setTimeout(() => {
                    reject(new TimeoutError('Task timeout'));
                }, this.timeout);

                task()
                    .then(result => {
                        clearTimeout(timer);
                        resolve(result);
                    })
                    .catch(err => {
                        clearTimeout(timer);
                        reject(err);
                    })
                    .finally(() => {
                        this.activeCount--;
                        this.next();
                    });
            };

            if (this.activeCount < this.concurrency) {
                this.activeCount++;
                wrappedTask();
            } else {
                this.queue.push(wrappedTask);
            }
        });
    }

    next() {
        if (this.queue.length > 0 && this.activeCount < this.concurrency) {
            this.activeCount++;
            const nextTask = this.queue.shift();
            nextTask();
        }
    }
}

module.exports = PromiseQueue;

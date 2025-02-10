class TimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TimeoutError';
    }
}

class PromiseQueue {
    constructor(concurrency = 1, timeout = 5000) {
        this.concurrency = concurrency; // Max concurrent tasks
        this.timeout = timeout; // Task timeout
        this.queue = []; // Task queue
        this.activeCount = 0; // Currently running tasks
    }

    async add(task) {
        return new Promise((resolve, reject) => {
            const wrappedTask = () => {
                console.log('Task dequeued. Active count:', this.activeCount, 'Queue length:', this.queue.length);

                // Start the task and handle success/failure
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
                        console.log('Task completed. Active count:', this.activeCount, 'Queue length:', this.queue.length);
                        this.next(); // Process the next task
                    });
            };

            // If concurrency allows, start the task immediately
            if (this.activeCount < this.concurrency) {
                this.activeCount++;
                console.log('Task started immediately. Active count:', this.activeCount);
                wrappedTask();
            } else {
                // Otherwise, queue it for later
                console.log('Task queued. Queue length:', this.queue.length + 1);
                this.queue.push(wrappedTask);
            }
        });
    }

    next() {
        if (this.queue.length > 0 && this.activeCount < this.concurrency) {
            this.activeCount++;
            const nextTask = this.queue.shift();
            console.log('Processing next task. Active count:', this.activeCount, 'Queue length:', this.queue.length);
            nextTask();
        }
    }
}

module.exports = PromiseQueue;

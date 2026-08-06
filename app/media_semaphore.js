class MediaCapacitySemaphore {
    constructor({ name = 'media', capacity = 1 } = {}) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new TypeError('MediaCapacitySemaphore capacity must be a positive integer');
        }

        this.name = name;
        this.capacity = capacity;
        this.activeLeases = new Map();
        this.nextLeaseId = 1;
    }

    tryAcquire({ jobId = null, label = null } = {}) {
        if (this.activeLeases.size >= this.capacity) return null;

        const leaseId = `${this.name}-${this.nextLeaseId++}`;
        const lease = {
            acquiredAt: Date.now(),
            jobId,
            label,
            leaseId,
        };
        this.activeLeases.set(leaseId, lease);
        console.log(
            `[MediaCapacity] Acquired ${leaseId}: ${this.activeLeases.size}/${this.capacity}` +
            `${label ? ` (${label})` : ''}`
        );

        let released = false;
        return {
            id: leaseId,
            release: () => {
                if (released) return false;
                released = true;
                this.activeLeases.delete(leaseId);
                console.log(
                    `[MediaCapacity] Released ${leaseId}: ${this.activeLeases.size}/${this.capacity}`
                );
                return true;
            },
        };
    }

    getStats() {
        return {
            name: this.name,
            capacity: this.capacity,
            activeCount: this.activeLeases.size,
            availableCount: this.capacity - this.activeLeases.size,
            activeLeases: Array.from(this.activeLeases.values()),
        };
    }
}

module.exports = { MediaCapacitySemaphore };

import { GraphSnapshot } from '../graph/GraphSnapshot';

/**
 * Animator manages playback of graph snapshots at a fixed frame rate.
 * Snapshots are queued and displayed sequentially, with each frame shown
 * for a specified duration.
 */
export class Animator {
    private queue: GraphSnapshot[] = [];
    private currentIndex = 0;
    private isPlaying = false;
    private frameRate = 1000; // milliseconds per frame
    private intervalId: number | null = null;
    private onFrameCallback: ((snapshot: GraphSnapshot, index: number, total: number) => void) | null = null;

    /**
     * Set the callback to invoke when a frame should be displayed.
     */
    setFrameCallback(callback: (snapshot: GraphSnapshot, index: number, total: number) => void): void {
        this.onFrameCallback = callback;
    }

    /**
     * Queue snapshots for playback. Starts playback if not already playing.
     */
    queueSnapshots(snapshots: GraphSnapshot[]): void {
        this.queue = snapshots;
        this.currentIndex = 0;

        if (!this.isPlaying) {
            this.play();
        }
    }

    /**
     * Start playback of queued snapshots.
     */
    private play(): void {
        if (this.isPlaying || this.queue.length === 0) return;

        this.isPlaying = true;

        // Display first frame immediately
        if (this.onFrameCallback && this.currentIndex < this.queue.length) {
            this.onFrameCallback(this.queue[this.currentIndex], this.currentIndex, this.queue.length);
        }

        // Schedule subsequent frames
        this.intervalId = window.setInterval(() => {
            this.currentIndex++;

            if (this.currentIndex >= this.queue.length) {
                // Playback complete
                this.stop();
                return;
            }

            if (this.onFrameCallback) {
                this.onFrameCallback(this.queue[this.currentIndex], this.currentIndex, this.queue.length);
            }
        }, this.frameRate);
    }

    /**
     * Stop playback.
     */
    stop(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isPlaying = false;
    }

    /**
     * Check if animation is currently playing.
     */
    isAnimating(): boolean {
        return this.isPlaying;
    }

    /**
     * Set the frame rate in milliseconds.
     */
    setFrameRate(ms: number): void {
        this.frameRate = ms;
    }
}

declare module './mpegts.js' {
    export interface MpegtsPlayer {
        attachMediaElement(element: HTMLMediaElement): void;
        load(): void;
        play(): void;
        pause(): void;
        destroy(): void;
        unload(): void;
        detachMediaElement(): void;
    }

    export interface PlayerConfig {
        type: string;
        url: string;
        isLive?: boolean;
    }

    export function getFeatureList(): { mseLivePlayback: boolean, mseFlvPlayback: boolean, msePort: boolean };
    export function isSupported(): boolean;
    export function createPlayer(mediaDataSource: PlayerConfig, config?: any): MpegtsPlayer;
    
    const mpegts: any;
    export default mpegts;
}

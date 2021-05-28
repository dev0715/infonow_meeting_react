import { AudioSharingConfig, ScreenSharingConfig, VideoSharingConfig } from "./config";

/**
 * Checks if Stream has a Video Track
 * @param {MediaStream} stream 
 */
export function isVideoEnabled(stream) {
    return stream.getVideoTracks().length > 0;
}

/**
 * Checks if Stream has a Video Track
 * @param {MediaStream} stream 
 */
export function isAudioEnabled(stream) {
    return stream.getAudioTracks().length > 0;
}


export async function getNewScreenTrack() {
    /**@type {MediaStream} */
    let stream = await navigator.mediaDevices.getDisplayMedia(ScreenSharingConfig)
    let track = stream.getVideoTracks()[0].clone();
    stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
    return track;
}

export async function getNewWebcamTrack() {
    /**@type {MediaStream} */
    let stream = await navigator.mediaDevices.getUserMedia(VideoSharingConfig)
    let track = stream.getVideoTracks()[0].clone();
    stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
    return track;
}

export async function getNewAudioTrack() {
    /**@type {MediaStream} */
    let stream = await navigator.mediaDevices.getUserMedia(AudioSharingConfig)
    let track = stream.getAudioTracks()[0].clone();
    stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
    return track;
}

/**
 *
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream
 * @param {'webcam'|'screen'} type
 */
export async function setNewVideoTrack(peerConnection, stream, type) {
    try {
        stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
        let getNewTrack = type === 'screen' ? getNewScreenTrack() : getNewWebcamTrack();
        let videoTrack = await getNewTrack;
        stream.addTrack(videoTrack);
        const senders = peerConnection.getSenders();
        senders.find(s => s.track.kind === videoTrack.kind).replaceTrack(videoTrack);
        return true;
    } catch (error) {
        console.log(error);
        return false;
    }
}


/**
 *
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream
 */
export async function setNewAudioTrack(peerConnection, stream) {
    try {
        stream.getAudioTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
        let audioTrack = await getNewAudioTrack();
        stream.addTrack(audioTrack);
        const senders = peerConnection.getSenders();
        senders.find(s => s.track.kind === audioTrack.kind).replaceTrack(audioTrack);
    } catch (error) {
        return error
    }

}

/**
 * 
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream 
 */
export function removeAllVideoTracks(peerConnection, stream) {
    removeAllTracks(peerConnection, stream, 'video')
}

/**
 * 
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream 
 */
export function removeAllAudioTracks(peerConnection, stream) {
    removeAllTracks(peerConnection, stream, 'audio')
}


/**
 * 
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream 
 * @param {'audio' | 'video'} kind
 */
function removeAllTracks(peerConnection, stream, kind) {
    stream.getTracks().filter(y => y.kind === kind)
        .forEach(t => {
            // Stop PeerConnectionStream
            peerConnection
                .getSenders()
                .filter(x => x.track.kind === t.kind)
                .forEach(x => x.track.stop())

            // Stop and Remove Stream
            t.stop();
            stream.removeTrack(t);
        });
}
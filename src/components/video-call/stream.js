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

export async function getNewWebcamTrack(deviceId = 'default') {
    /**@type {MediaStream} */
    VideoSharingConfig.video.deviceId = deviceId
    let stream = await navigator.mediaDevices.getUserMedia(VideoSharingConfig)
    let track = stream.getVideoTracks()[0].clone();
    stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
    return track;
}

export async function getNewAudioTrack(deviceId = 'default') {
    /**@type {MediaStream} */
    AudioSharingConfig.audio.deviceId = deviceId
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
 * @param {String} deviceId
 * @param {function} callback
 */
export async function setNewVideoTrack(peerConnection, stream, type, deviceId, callback) {
    try {
        stream.getVideoTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
        let getNewTrack = type === 'screen' ? getNewScreenTrack() : getNewWebcamTrack(deviceId);
        let videoTrack = await getNewTrack;
        videoTrack.onended = callback;
        setNewTrack(peerConnection, stream, videoTrack);
        return null;
    } catch (error) {
        return error;
    }
}


/**
 *
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStream} stream
 * @param {String} deviceId
 */
export async function setNewAudioTrack(peerConnection, stream, deviceId) {
    try {
        stream.getAudioTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
        let audioTrack = await getNewAudioTrack(deviceId);

        setNewTrack(peerConnection, stream, audioTrack);
        return null
    } catch (error) {
        return error
    }

}

async function setNewTrack(peerConnection, stream, track) {
    stream.addTrack(track);
    if (peerConnection) {
        const senders = peerConnection.getSenders();
        let t = senders.filter(x => x.track).find(s => s.track.kind === track.kind);
        if (t) {
            console.log(`Replacing ${track.kind} track to Sender`);
            t.replaceTrack(track)
        } else {
            console.log(`Adding new ${track.kind} track to Peer Connection`);
            peerConnection.addTrack(track, stream);
        }
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
            if (peerConnection) {
                peerConnection
                    .getSenders()
                    .filter(x => x.track)
                    .filter(x => x.track.kind === t.kind)
                    .forEach(x => x.track.stop())
            }

            // Stop and Remove Stream
            t.stop();
            stream.removeTrack(t);
        });
}

/**
 * 
 * @param {'audioinput' | 'videoinput'} type 
 */

export async function getConnectedDevices(type) {
    return await navigator.mediaDevices.enumerateDevices();

}
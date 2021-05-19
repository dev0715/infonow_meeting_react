import { screenSharingConfig, videoSharingConfig } from "./config";
import { IOEvents } from "./events";

export function toast(x, text) {
    x.innerHTML = text
    x.className = "show";
    setTimeout(function () {
        x.className = x.className.replace("show", "");
    }, 3000);
}

export async function createOffer(peerConnection, socket, meetingId) {
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);
    socket.emit(IOEvents.CREATE_ROOM, {
        type: IOEvents.CREATE_ROOM,
        meetingId: meetingId,
        data: {
            sdp: offerDescription.sdp,
            type: offerDescription.type,
        }
    });
    console.log("emiting offer", socket)
}


export function setupIceEventOnStartCall(peerConnection, candidates, socket, onEndCall) {

    console.log("setupIceEventOnStartCall");
    console.log(candidates);
    candidates.forEach(c => {
        console.log("ice array event")
        socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
            type: IOEvents.CREATE_ICE_EVENT_DATA,
            data: c
        });
    });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("local ice event")
            socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                type: IOEvents.CREATE_ICE_EVENT_DATA,
                data: event.candidate.toJSON()
            });
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState == 'disconnected') {
            onEndCall && onEndCall()
        }
    }
}

export function addIceCandidate(peerConnection, iceEvent) {
    if (iceEvent) {
        console.log("NEW_ICE_EVENT_ADDED")
        const candidate = new RTCIceCandidate(iceEvent);
        peerConnection.addIceCandidate(candidate);
    }
}

export function closeStream(ref, stream) {
    try {
        if (stream) {
            stream.getAudioTracks()[0].stop();
            stream.getVideoTracks()[0].stop();
        }
        if (ref) ref.srcObject = null
    } catch (error) {
        console.log("CLOSING LOCAL STREAM")
    }
}

export function toggleMicrophone(stream, setIsLocalMicMute, socket) {
    let microphoneStatus = !(stream.getAudioTracks()[0].enabled)
    stream.getAudioTracks()[0].enabled = microphoneStatus;
    setIsLocalMicMute(!microphoneStatus)
    socket.emit(microphoneStatus ? IOEvents.UNMUTE_AUDIO : IOEvents.MUTE_AUDIO);
}

export function toggleVideo(stream, setIsLocalVideoMute, socket) {
    let videoStatus = !(stream.getVideoTracks()[0].enabled)
    stream.getVideoTracks()[0].enabled = videoStatus
    setIsLocalVideoMute(!videoStatus)
    socket.emit(videoStatus ? IOEvents.UNMUTE_VIDEO : IOEvents.MUTE_VIDEO);
}


export async function toggleScreenShare({
    localVideoRef,
    screenStream,
    peerConnection,
    setIsLocalScreenSharing,
    isLocalScreenSharing,
    socket
}) {
    try {
        let stream = isLocalScreenSharing
            ? navigator.mediaDevices.getUserMedia(videoSharingConfig)
            : navigator.mediaDevices.getDisplayMedia(screenSharingConfig)
        screenStream = await stream
        setIsLocalScreenSharing(!isLocalScreenSharing);

        let videoTrack = screenStream.getVideoTracks()[0];
        var sender = peerConnection.getSenders().find(s => s.track.kind == videoTrack.kind);

        sender.replaceTrack(videoTrack);
        localVideoRef.srcObject = screenStream;
        socket.emit(isLocalScreenSharing ? IOEvents.SCREEN_SHARING : IOEvents.VIDEO_SHARING)

        videoTrack.onended = () => toggleScreenShare({
            localVideoRef,
            screenStream,
            peerConnection,
            setIsLocalScreenSharing,
            isLocalScreenSharing,
            socket
        })

    } catch (error) {
        console.log("Screen Toggle Error", error)
    }

}
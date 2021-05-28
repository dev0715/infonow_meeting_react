import React, { useEffect, useState } from 'react'
import io from "socket.io-client"
import { Row, Col } from 'reactstrap'

import './style.css';
import { IOEvents } from "./events"
import { servers, VideoSharingConfig, ScreenSharingConfig, IOConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';
import { removeAllAudioTracks, removeAllVideoTracks, setNewAudioTrack, setNewVideoTrack } from './stream';


// Global State
/**@type {RTCPeerConnection} */
let peerConnection = null;

/**@type {MediaStream} */
let localStream = null;

/**@type {MediaStream} */
let remoteStream = null;

let isLocalScreenSharingFlag = false

var candidates = [];
let socket;



export const VideoCall = () => {

    const [isAuthorized, setAuthorized] = useState(false);
    const [isFirstAttempt, setFirstAttempt] = useState(true);

    const [isJoined, setJoined] = useState(false);
    const [isCalling, setCalling] = useState(false);
    const [isCallStarted, setCallStarted] = useState(false);

    const [isRemoteMicMute, setRemoteMicMute] = useState(false);
    const [isRemoteVideoMute, setRemoteVideoMute] = useState(false);
    const [isRemoteScreenSharingEnabled, setRemoteScreenSharingEnabled] = useState(false);
    const [isRemoteBoardOpen, setRemoteBoardOpen] = useState(false);

    const [isLocalAudioSharing, setLocalAudioSharing] = useState(true);
    const [isLocalVideoSharing, setLocalVideoSharing] = useState(true);
    const [isLocalScreenSharing, setLocalScreenSharing] = useState(false);

    const [isLocalBoardOpen, setLocalBoardOpen] = useState(false);
    const [boardUrl, setBoardUrl] = useState(null);

    const [webcamVideoRef, setWebcamVideoRef] = useState(React.createRef());
    const [remoteVideoRef, setRemoteVideoRef] = useState(React.createRef());

    const [isLocalVideoHidden, setLocalVideoHidden] = useState(false);

    const [user, setUser] = useState({});
    const [remoteUser, setRemoteUser] = useState({});

    const { token, meetingId, lang } = useParams();

    const endCallCallback = (event, res) => {
        console.log(event, res)
        if (res.message) {
            toast(res.message)
        }
        endVideoCall()
    }

    function initSocket() {
        socket = io(URLs.main, IOConfig);

        socket.on(IOEvents.CONNECT, function () {
            socket.emit(IOEvents.SET_LANGUAGE, {
                locale: lang ?? "en"
            })
            console.log(IOEvents.CONNECT)
            socket.emit(IOEvents.AUTHORIZATION, { authorization: decodeURIComponent(token) })
        });

        socket.on(IOEvents.AUTHORIZATION, function (res) {
            console.log(IOEvents.AUTHORIZATION, res)
            //------------static for testing ----------//
            if (res.success) {
                toast(`Welcome ${res.data.name}, you are successfully authorized`)
                setAuthorized(true)
                setUser(res.data);
            }
            else {
                setAuthorized(false)
                setUser({});
                toast("You are not authorized")
            }
        });

        socket.on(IOEvents.ALREADY_JOINED, res => endCallCallback(IOEvents.ALREADY_JOINED, res));
        socket.on(IOEvents.INVALID_PARTICIPANT, res => endCallCallback(IOEvents.INVALID_PARTICIPANT, res));
        socket.on(IOEvents.MEETING_NOT_FOUND, res => endCallCallback(IOEvents.MEETING_NOT_FOUND, res));
        socket.on(IOEvents.MEETING_NOT_ACTIVE, res => endCallCallback(IOEvents.MEETING_NOT_ACTIVE, res));
        socket.on(IOEvents.ROOM_NOT_FOUND, res => endCallCallback(IOEvents.ROOM_NOT_FOUND, res));

        socket.on(IOEvents.CREATE_ROOM, () => {
            console.log(IOEvents.CREATE_ROOM)
            if (isFirstAttempt) {
                setFirstAttempt(false)
                peerConnection.close()
                setTimeout(() => {
                    startVideoCall()
                }, 200);
            } else {
                toast("Failed to connect to peer, try again")
                endVideoCall()
            }
        })

        socket.on(IOEvents.ROOM_EXIST, function () {
            console.log(IOEvents.ROOM_EXIST)
            closeLocalStream()
            peerConnection.close()
            setTimeout(() => {
                initPeerConnection()
                candidates = []
                setupIceEventBeforeStartCall()
                joinRoom()
            }, 200);

        });

        socket.on(IOEvents.CREATE_ICE_EVENT_DATA, (res) => {
            console.log(IOEvents.CREATE_ICE_EVENT_DATA, res)
            try {
                if (res.data) {
                    console.log(IOEvents.CREATE_ICE_EVENT_DATA);
                    const candidate = new RTCIceCandidate(res.data);
                    peerConnection.addIceCandidate(candidate);
                }
            } catch (error) {
                console.log("CREATE_ICE_EVENT_DATA_ERROR", error)
            }
        });

        socket.on(IOEvents.RECEIVE_ANSWER, (res) => {
            console.log(IOEvents.RECEIVE_ANSWER, res)
            if (res.user) {
                setRemoteUser(res.user)
            }
            if (!peerConnection.currentRemoteDescription && res.answer) {
                console.log(IOEvents.RECEIVE_ANSWER);
                const answerDescription = new RTCSessionDescription(res.answer);
                peerConnection.setRemoteDescription(answerDescription);
                socket.emit(IOEvents.START_CALL, {
                    type: IOEvents.RECEIVE_ANSWER
                });
            }
        });

        socket.on(IOEvents.ROOM_JOIN, async (res) => {
            console.log(IOEvents.ROOM_JOIN, res)
            try {
                if (res.data) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                    const answerDescription = await peerConnection.createAnswer();
                    await peerConnection.setLocalDescription(answerDescription);
                    //----------------------------------------//
                    //---------------SEND ANSWER-------------//
                    //--------------------------------------//
                    socket.emit(IOEvents.ANSWER_CALL, {
                        type: IOEvents.ANSWER_CALL,
                        data: {
                            type: answerDescription.type,
                            sdp: answerDescription.sdp,
                        }
                    });
                }
            } catch (error) {
                console.log("ROOM_JOIN_ERROR", error)
            }
        });

        socket.on(IOEvents.JOINED_ROOM_AS_RECEIVER, function (res) {
            console.log(IOEvents.JOINED_ROOM_AS_RECEIVER, res)
            if (res.data) {
                toast(`${res.data.name} has already joined the meeting`)
                setRemoteUser(res.data);
                setJoined(true);
            } else {
                endVideoCall()
            }
        });

        socket.on(IOEvents.CALL_ON_WAIT, function () {
            console.log(IOEvents.CALL_ON_WAIT)
            setJoined(true)
        });

        socket.on(IOEvents.START_CALL, () => {
            console.log(IOEvents.START_CALL)
            setupIceEventOnStartCall()
            setCallStarted(true)
        });

        socket.on(IOEvents.END_CALL, function () {
            console.log(IOEvents.END_CALL)
            closeConnection()
            resetAllStates()
        });

        socket.on(IOEvents.MUTE_AUDIO, function () {
            console.log(IOEvents.MUTE_AUDIO)
            setRemoteMicMute(true)
        });

        socket.on(IOEvents.UNMUTE_AUDIO, function () {
            console.log(IOEvents.UNMUTE_AUDIO)
            setRemoteMicMute(false)
        });

        socket.on(IOEvents.MUTE_VIDEO, function () {
            console.log(IOEvents.MUTE_VIDEO)
            setRemoteVideoMute(true)
            remoteVideoRef.current.srcObject = null
        });

        socket.on(IOEvents.UNMUTE_VIDEO, function () {
            console.log(IOEvents.UNMUTE_VIDEO)
            remoteVideoRef.current.srcObject = remoteStream
            setRemoteVideoMute(false)

        });

        socket.on(IOEvents.SCREEN_SHARING_ENABLED, function () {
            console.log(IOEvents.SCREEN_SHARING_ENABLED)
            remoteVideoRef.current.srcObject = remoteStream;
            setRemoteScreenSharingEnabled(true)
        });

        socket.on(IOEvents.SCREEN_SHARING_DISABLED, function () {
            console.log(IOEvents.SCREEN_SHARING_DISABLED)
            remoteVideoRef.current.srcObject = null;
            setRemoteScreenSharingEnabled(false)
        });

        socket.on(IOEvents.OPEN_BOARD, function () {
            console.log(IOEvents.OPEN_BOARD)
            setRemoteBoardOpen(true)
        });

        socket.on(IOEvents.CLOSE_BOARD, function () {
            console.log(IOEvents.CLOSE_BOARD)
            setRemoteBoardOpen(false)
        });
    }

    function init() {

        initSocket()

    }

    useEffect(init, [])

    function hideLocalVideo() {
        setLocalVideoHidden(true)
    }

    function showLocalVideo() {
        setLocalVideoHidden(false)
    }

    function initPeerConnection() {
        try {
            // Global State
            peerConnection = new RTCPeerConnection(servers);
            localStream = null;
            remoteStream = null;
        } catch (error) {
            console.log("INIT_PEER_CONNECTION_ERROR", error)
        }
    }

    function setupIceEventOnStartCall() {

        console.log("SETUP_ICE_EVENT_ON_START_CALL");

        candidates.forEach(c => {
            console.log("ICE_ARRAY_EVENT")
            socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                type: IOEvents.CREATE_ICE_EVENT_DATA,
                data: c
            });
        });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("LOCAL_ICE_EVENT",)
                socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                    type: IOEvents.CREATE_ICE_EVENT_DATA,
                    data: event.candidate.toJSON()
                });
            }
        };

    }

    function setupIceEventBeforeStartCall() {
        console.log("SETUP_ICE_EVENT_BEFORE_START_CALL");
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("ICE_EVENT_BEFORE_START_CALL")
                candidates.push(event.candidate.toJSON())
            }
        };

    }

    function closeRemoteStream() {
        try {
            console.log("CLOSING_REMOTE_STREAM")
            if (remoteStream) {
                removeAllVideoTracks(peerConnection, remoteStream)
                removeAllAudioTracks(peerConnection, remoteStream)
                remoteVideoRef.current.srcObject = null
            }
        } catch (error) {
            console.warn("CLOSING_REMOTE_STREAM_ERROR", error)
        }
    }

    function closeLocalStream() {
        try {
            console.log("CLOSING_LOCAL_STREAM")
            if (localStream) {
                removeAllVideoTracks(peerConnection, localStream)
                removeAllAudioTracks(peerConnection, localStream)
                webcamVideoRef.current.srcObject = null
            }
        }
        catch (error) {
            console.warn("CLOSING_LOCAL_STREAM_ERROR", error)
        }
    }

    function closeConnection() {
        closeLocalStream()
        closeRemoteStream();
        peerConnection.close();
    }

    async function getNewLocalStream(isScreen = false) {
        let stream;
        if (isScreen) {
            stream = await navigator.mediaDevices.getDisplayMedia(ScreenSharingConfig)
        }
        else {
            stream = await navigator.mediaDevices.getUserMedia(VideoSharingConfig)
        }
        return stream;
    }


    async function initCamera() {

        try {
            localStream = await getNewLocalStream();
            remoteStream = new MediaStream();

            // Push tracks from local stream to peer connection
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });

            // Pull tracks from remote stream, add to video stream
            peerConnection.ontrack = (event) => {

                event.streams[0].getTracks().forEach((track) => {
                    remoteStream.addTrack(track);
                });
            };

            webcamVideoRef.current.srcObject = localStream
            remoteVideoRef.current.srcObject = remoteStream
        } catch (error) {
            console.log("INIT_CAMERA_ERROR", error)
        }

    }

    function toggleBoard() {
        socket.emit(isLocalBoardOpen ? IOEvents.CLOSE_BOARD : IOEvents.OPEN_BOARD)
        setBoardUrl(isLocalBoardOpen ? null : getWhiteboardUrl(meetingId, user.userId))
        setLocalBoardOpen(!isLocalBoardOpen)

    }

    function createRoom() {

        initCamera()

        setTimeout(async () => {

            try {
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
                setupIceEventBeforeStartCall()
            } catch (error) {
                console.log("CREATE_ROOM_FUNCTION_ERROR", error)
            }
        }, 1000);
    }

    function joinRoom() {

        initCamera()

        setTimeout(async () => {
            socket.emit(IOEvents.ROOM_JOIN, {
                type: IOEvents.ROOM_JOIN,
                meetingId: meetingId,
            });

        }, 1000);
    }

    async function toggleMicrophone() {
        if (isLocalAudioSharing) {
            removeAllAudioTracks(peerConnection, localStream);
        }
        else {
            await setNewAudioTrack(peerConnection, localStream)
        }
        socket.emit(isLocalAudioSharing ? IOEvents.MUTE_AUDIO : IOEvents.UNMUTE_AUDIO)
        setLocalAudioSharing(!isLocalAudioSharing)
    }

    useEffect(() => {
        console.log("IS_LOCAL_SCREEN_SHARING", isLocalScreenSharing, isLocalScreenSharingFlag)
    }, [isLocalScreenSharing])


    async function toggleVideo() {

        stopScreenStream()

        if (isLocalVideoSharing) {
            removeAllVideoTracks(peerConnection, localStream);
            webcamVideoRef.current.srcObject = null
        }
        else {
            await setNewVideoTrack(peerConnection, localStream, 'webcam')
            webcamVideoRef.current.srcObject = localStream
        }

        socket.emit(isLocalVideoSharing ? IOEvents.MUTE_VIDEO : IOEvents.UNMUTE_VIDEO)
        setLocalVideoSharing(!isLocalVideoSharing)
    }

    async function stopWebcamStream() {
        if (isLocalVideoSharing) {
            removeAllVideoTracks(peerConnection, localStream);
            webcamVideoRef.current.srcObject = null
            socket.emit(IOEvents.MUTE_VIDEO)
            setLocalVideoSharing(false)
        }
    }

    async function startWebcamStream() {
        await setNewVideoTrack(peerConnection, localStream, 'webcam')
        webcamVideoRef.current.srcObject = localStream
        socket.emit(IOEvents.UNMUTE_VIDEO)
        setLocalVideoSharing(true)
    }

    async function stopScreenStream() {
        removeAllVideoTracks(peerConnection, localStream);
        webcamVideoRef.current.srcObject = null
        isLocalScreenSharingFlag = false
        socket.emit(IOEvents.SCREEN_SHARING_DISABLED)
        setLocalScreenSharing(isLocalScreenSharingFlag)
    }

    async function toggleScreenShare() {
        try {

            stopWebcamStream()

            if (isLocalScreenSharingFlag) {
                removeAllVideoTracks(peerConnection, localStream);
                webcamVideoRef.current.srcObject = null
            }
            else {
                let success = await setNewVideoTrack(peerConnection, localStream, 'screen')
                if (!success) {
                    webcamVideoRef.current.srcObject = isLocalVideoSharing ? localStream : null
                    throw "Screen Share Cancelled."
                }
                webcamVideoRef.current.srcObject = localStream
            }

            isLocalScreenSharingFlag = !isLocalScreenSharingFlag
            socket.emit(isLocalScreenSharingFlag ? IOEvents.SCREEN_SHARING_ENABLED : IOEvents.SCREEN_SHARING_DISABLED)
            setLocalScreenSharing(isLocalScreenSharingFlag)

        } catch (error) {
            console.log("Screen Toggle Error", error)
            startWebcamStream()
        }
    }

    function toast(text) {
        let x = document.getElementById("snackbar");
        x.innerHTML = text
        x.className = "show";

        setTimeout(function () {
            x.className = x.className.replace("show", "");
        }, 3000);
    }

    async function startVideoCall() {
        setCalling(true)
        initPeerConnection()
        setTimeout(createRoom, 1000);
    }

    function endVideoCall() {
        socket.emit(IOEvents.END_CALL);
        closeConnection()
        resetAllStates()
    }

    function resetAllStates() {

        setFirstAttempt(true)
        setJoined(false)
        setCalling(false)
        setCallStarted(false)
        setRemoteMicMute(false)
        setRemoteVideoMute(false)
        setRemoteScreenSharingEnabled(false)
        setRemoteBoardOpen(false)

        setLocalAudioSharing(true)
        setLocalVideoSharing(true)
        setLocalScreenSharing(false)
        isLocalScreenSharingFlag = false

        setLocalBoardOpen(false)
        setBoardUrl(null)
        setLocalVideoHidden(false)
        webcamVideoRef.current.srcObject = null
        remoteVideoRef.current.srcObject = null
        setRemoteUser({})
    }

    function isWebCamViewActive() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        if (isLocalBoardOpen) active = true
        return active
    }

    function isRemoteViewActive() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        if (isLocalBoardOpen) active = false
        return active
    }

    return (
        <Row>
            <Col lg={12} id="videos" className={isCallStarted ? "active" : ""}>
                <span
                    style={{
                        display: (isLocalVideoSharing || isLocalScreenSharing) && !isLocalVideoHidden ? "initial" : "none",
                    }}
                >
                    <video id="webcamVideo"
                        ref={webcamVideoRef}
                        className={isWebCamViewActive() ? "active" : ""}
                        muted="muted"
                        autoPlay={true}
                        playsInline
                        style={{
                            objectFit: 'contain',
                        }}
                    ></video>
                    {
                        isCallStarted &&
                        <button id="hideLocalVideoBtn" onClick={hideLocalVideo}>
                            <i className="la la-close"></i>
                        </button>
                    }
                </span>
                <span>
                    <video id="remoteVideo"
                        ref={remoteVideoRef}
                        className={isRemoteViewActive() ? "active" : ""}
                        autoPlay={true}
                        playsInline
                        style={{
                            objectFit: 'contain'
                        }}
                    ></video>
                </span>
                {
                    isLocalBoardOpen &&
                    <iframe
                        title="WhiteBoard"
                        id="whiteBoard"
                        src={boardUrl}
                    >
                    </iframe>
                }
                {
                    isCallStarted &&
                    <>
                        <div id="indicator-container">
                            <div className="btns">
                                {
                                    Object.keys(remoteUser).length > 0 &&
                                    <>
                                        <span>
                                            <i className="la la-user"></i>
                                        &nbsp;
                                        {remoteUser.name}
                                        </span>
                                    </>
                                }
                                <div className="indicator">
                                    {
                                        isRemoteMicMute &&
                                        <span>
                                            <i className="la la-microphone-slash "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteVideoMute &&
                                        <span>
                                            <i className="las la-video-slash "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteScreenSharingEnabled &&
                                        <span>
                                            <i className="las la-desktop "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteBoardOpen &&
                                        <span>
                                            <i className="las la-pencil-alt"></i>
                                        </span>
                                    }
                                </div>
                            </div>
                        </div>
                    </>
                }
                <div id="btn-video-call-container">
                    {
                        !isCallStarted &&
                        <button id="joinBtn"
                            disabled={isCalling || !isAuthorized}
                            onClick={startVideoCall}
                            className={!isCalling ? 'not-calling' : ''}
                        >
                            {
                                !isCalling ? "Join Meeting" : (isJoined ? "Waiting for peer to Join" : "Joining")
                            }
                        </button>
                    }
                    {
                        (isCalling || isCallStarted) &&
                        <button
                            id="hangupButton"
                            onClick={endVideoCall}
                        >
                            <i className="la la-phone"></i>
                        </button>
                    }
                    {
                        isCallStarted &&
                        <>
                            <button
                                className="operation-btn"
                                onClick={toggleMicrophone}
                            >
                                <i className={isLocalAudioSharing ? "la la-microphone" : "las la-microphone-slash"} ></i>
                            </button>
                            <button
                                className="operation-btn"
                                onClick={toggleVideo}
                                disabled={isLocalScreenSharing}
                            >
                                <i className={isLocalVideoSharing ? "la la-video" : "las la-video-slash"} ></i>
                            </button>
                            <button
                                className="operation-btn"
                                onClick={toggleScreenShare}
                            >
                                <i className={isLocalScreenSharing ? "las la-camera" : "las la-desktop"} ></i>
                            </button>
                            {
                                isLocalVideoHidden &&
                                <button
                                    className="operation-btn"
                                    onClick={showLocalVideo}
                                >
                                    <i className="lab la-creative-commons-by"></i>
                                </button>
                            }
                            <button
                                className="operation-btn"
                                onClick={toggleBoard}
                            >
                                <i className={isLocalBoardOpen ? "las la-pencil-ruler" : "las la-pencil-alt"} ></i>
                            </button>
                        </>
                    }
                </div>

            </Col>
            <div className="text-center">
                <div id="snackbar"></div>
            </div>
        </Row >
    );

}

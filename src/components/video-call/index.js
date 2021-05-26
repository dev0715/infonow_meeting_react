import React, { useEffect, useState } from 'react'
import io from "socket.io-client"
import { Row, Col } from 'reactstrap'

import './style.css';
import { IOEvents } from "./events"
import { servers, VideoSharingConfig, ScreenSharingConfig, IOConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';



// let videoContainer = null;

// let webcamVideoContainer = null;
// let webcamVideo = null;
// let remoteVideo = null;
// let joinBtn = null;
// let hangupButton = null;
// let muteAudioBtn = null;
// let muteVideoBtn = null;
// let hideLocalVideoBtn = null;
// let showLocalVideoBtn = null;
// let screenShareBtn = null;
// let whiteBoard = null;
// let boardBtn = null;
// let isBoardVisible = false;
// let isRemoteVideoMuted = false;

// let indicatorContainer = null;
// let userAudioMuteIndicator = null;
// let userVideoMuteIndicator = null;
// let userScreenSharingMuteIndicator = null;

// let callBtnContainer = null;


// Global State
let pc = null;
let localStream = null;
let remoteStream = null;
let toggleStreamObj = null;

var candidates = [];

// let isJoined = false;
// let isScreenShared = false;

let socket;

// let user = {};

export const VideoCall = () => {


    const [isAuthorized, setAuthorized] = useState(false);

    const [isJoined, setJoined] = useState(false);
    const [isCalling, setCalling] = useState(false);
    const [isCallStarted, setCallStarted] = useState(false);

    const [isRemoteMicMute, setRemoteMicMute] = useState(false);
    const [isRemoteVideoMute, setRemoteVideoMute] = useState(false);
    const [isRemoteScreenSharing, setRemoteScreenSharing] = useState(false);
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

        socket.on(IOEvents.END_CALL, function () {
            console.log(IOEvents.END_CALL)
            endVideoCall()
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

        socket.on(IOEvents.ROOM_EXIST, function () {

            console.log(IOEvents.ROOM_EXIST)

            closeLocalStream()
            pc.close()

            setTimeout(() => {

                initVideoState()
                candidates = []
                setupIceEventBeforeStartCall()
                joinRoom()
            }, 200);

        });


        socket.on(IOEvents.CREATE_ICE_EVENT_DATA, (data) => {
            console.log(IOEvents.CREATE_ICE_EVENT_DATA, data)
            if (data) {
                console.log(IOEvents.CREATE_ICE_EVENT_DATA);
                const candidate = new RTCIceCandidate(data);
                pc.addIceCandidate(candidate);
            }

        });

        socket.on(IOEvents.RECEIVE_ANSWER, (res) => {
            console.log(IOEvents.RECEIVE_ANSWER, res)
            if (res.user) {
                setRemoteUser(res.user)
            }

            if (!pc.currentRemoteDescription && res.answer) {
                console.log(IOEvents.RECEIVE_ANSWER);
                const answerDescription = new RTCSessionDescription(res.answer);
                pc.setRemoteDescription(answerDescription);
                socket.emit(IOEvents.START_CALL, {
                    type: IOEvents.RECEIVE_ANSWER
                });
            }

        });

        socket.on(IOEvents.ROOM_JOIN, async (data) => {
            console.log(IOEvents.ROOM_JOIN, data)
            if (data) {
                await pc.setRemoteDescription(new RTCSessionDescription(data));

                const answerDescription = await pc.createAnswer();
                await pc.setLocalDescription(answerDescription);

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
        });

        socket.on(IOEvents.UNMUTE_VIDEO, function () {
            console.log(IOEvents.UNMUTE_VIDEO)
            setRemoteVideoMute(false)
        });

        socket.on(IOEvents.SCREEN_SHARING, function () {
            console.log(IOEvents.SCREEN_SHARING)
            setRemoteScreenSharing(true)
        });

        socket.on(IOEvents.VIDEO_SHARING, function () {
            console.log(IOEvents.VIDEO_SHARING)
            setRemoteScreenSharing(false)
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

    useEffect(() => {
        init()
    }, [])


    function hideLocalVideo() {
        setLocalVideoHidden(true)
    }

    function showLocalVideo() {
        setLocalVideoHidden(false)
    }

    function initVideoState() {
        // Global State
        pc = new RTCPeerConnection(servers);
        localStream = null;
        remoteStream = null;
        toggleStreamObj = null;
    }

    function setupIceEventOnStartCall() {

        console.log("setupIceEventOnStartCall");

        candidates.forEach(c => {
            console.log("ice array event")
            socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                type: IOEvents.CREATE_ICE_EVENT_DATA,
                data: c
            });
        });

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("local ice event",)
                socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                    type: IOEvents.CREATE_ICE_EVENT_DATA,
                    data: event.candidate.toJSON()
                });
            }
        };

    }

    function setupIceEventBeforeStartCall() {

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("ice")
                candidates.push(event.candidate.toJSON())
            }
        };

    }

    function closeRemoteStream() {
        try {
            remoteStream.getAudioTracks()[0].stop();
            remoteStream.getVideoTracks()[0].stop();
            remoteVideoRef.current.srcObject = null
        } catch (error) {
            console.log("CLOSING REMOTE STREAM")
        }

    }

    function closeLocalStream() {
        try {
            localStream.getAudioTracks()[0].stop();
            localStream.getVideoTracks()[0].stop();
            webcamVideoRef.current.srcObject = null
            if (toggleStreamObj) {
                toggleStreamObj.getAudioTracks()[0].stop();
                toggleStreamObj.getVideoTracks()[0].stop();
            }

        } catch (error) {
            console.log("CLOSING LOCAL STREAM")
        }

    }

    function closeConnection() {

        closeLocalStream()
        closeRemoteStream();
        if (pc) {
            pc.close();
        }
    }
    //DONE
    async function initCamera() {
        //
        localStream = await navigator.mediaDevices.getUserMedia(VideoSharingConfig);
        remoteStream = new MediaStream();

        // Push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

        // Pull tracks from remote stream, add to video stream
        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
        };

        webcamVideoRef.current.srcObject = localStream
        remoteVideoRef.current.srcObject = remoteStream
    }


    function toggleBoard() {
        socket.emit(isLocalBoardOpen ? IOEvents.CLOSE_BOARD : IOEvents.OPEN_BOARD)
        setBoardUrl(isLocalBoardOpen ? null : getWhiteboardUrl(meetingId, user.userId))
        setLocalBoardOpen(!isLocalBoardOpen)

    }

    function createRoom() {

        initCamera()

        setTimeout(async () => {

            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);

            socket.emit(IOEvents.CREATE_ROOM, {
                type: IOEvents.CREATE_ROOM,
                meetingId: meetingId,
                data: {
                    sdp: offerDescription.sdp,
                    type: offerDescription.type,
                }
            });

            setupIceEventBeforeStartCall()

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

    function toggleMicrophone() {

        localStream.getAudioTracks()[0].enabled = !(localStream.getAudioTracks()[0].enabled);
        socket.emit(localStream.getAudioTracks()[0].enabled ? IOEvents.UNMUTE_AUDIO : IOEvents.MUTE_AUDIO)
        setLocalAudioSharing(localStream.getAudioTracks()[0].enabled)
    }

    function toggleVideo() {

        localStream.getVideoTracks()[0].enabled = !(localStream.getVideoTracks()[0].enabled);
        socket.emit(localStream.getVideoTracks()[0].enabled ? IOEvents.UNMUTE_VIDEO : IOEvents.MUTE_VIDEO)
        setLocalVideoSharing(localStream.getVideoTracks()[0].enabled)

    }

    async function toggleScreenShare() {

        try {
            console.log("isLocalScreenSharing", isLocalScreenSharing)
            if (isLocalScreenSharing) {
                toggleStreamObj = await navigator.mediaDevices.getUserMedia(VideoSharingConfig)
            } else {
                toggleStreamObj = await navigator.mediaDevices.getDisplayMedia(ScreenSharingConfig)
            }

            let videoTrack = toggleStreamObj.getVideoTracks()[0];

            let sender = pc.getSenders().find(function (s) {
                return s.track.kind == videoTrack.kind;
            });
            sender.replaceTrack(videoTrack);
            videoTrack.onended = () => {
                toggleScreenShare()
            }
            webcamVideoRef.current.srcObject = toggleStreamObj

            socket.emit(isLocalScreenSharing ? IOEvents.VIDEO_SHARING : IOEvents.SCREEN_SHARING)

            setLocalScreenSharing(!isLocalScreenSharing)

        } catch (error) {
            console.log("Screen Toggle Error", error)
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
        initVideoState()
        setTimeout(createRoom, 1000);
    }

    function endVideoCall() {
        if (isJoined) {
            socket.emit(IOEvents.END_CALL);
        }
        closeConnection()
        resetAllStates()
    }

    function resetAllStates() {

        setJoined(false)
        setCalling(false)
        setCallStarted(false)
        setRemoteMicMute(false)
        setRemoteVideoMute(false)
        setRemoteScreenSharing(false)
        setRemoteBoardOpen(false)

        setLocalAudioSharing(true)
        setLocalVideoSharing(true)
        setLocalScreenSharing(false)
        setLocalBoardOpen(false)
        setBoardUrl(null)
        setLocalVideoHidden(false)
        webcamVideoRef.current.srcObject = null
        remoteVideoRef.current.srcObject = null
        setRemoteUser({})
    }


    return (
        <Row>
            <Col lg={12} id="videos" className={isCallStarted ? "active" : ""}>
                <span>
                    <video id="webcamVideo"
                        ref={webcamVideoRef}
                        className={isCallStarted ? (isRemoteVideoMute ? "" : "active") : ""}
                        muted="muted" autoPlay={true}
                        playsInline
                        style={{
                            objectFit: 'contain',
                            display: isLocalVideoHidden ? 'none' : 'initial',
                        }}
                    ></video>
                    {
                        isCallStarted && !isLocalVideoHidden && isLocalVideoSharing && !isRemoteVideoMute &&
                        <button id="hideLocalVideoBtn" onClick={hideLocalVideo}>
                            <i className="la la-close"></i>
                        </button>
                    }
                </span>

                <span>
                    <video id="remoteVideo"
                        ref={remoteVideoRef}
                        className={isCallStarted ? (isRemoteVideoMute ? "" : "active") : ""}
                        autoPlay={true} playsInline
                        style={{ objectFit: 'contain', display: isLocalBoardOpen ? 'none' : 'initial' }}
                    ></video>
                </span>
                {
                    isLocalBoardOpen &&
                    <iframe id="whiteBoard" src={boardUrl} >
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
                                        <span >
                                            <i className="la la-user"></i>
                                &nbsp;
                                {remoteUser.name}
                                        </span>
                                    </>
                                }
                                <div className="indicator">
                                    {
                                        isRemoteMicMute &&
                                        <span id="user-audio-icon" >
                                            <i className="la la-microphone-slash "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteVideoMute &&
                                        <span id="user-video-icon"  >
                                            <i className="las la-video-slash "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteScreenSharing &&
                                        <span id="user-screen-sharing-icon" >
                                            <i className="las la-desktop "></i>
                                        </span>
                                    }
                                    {
                                        isRemoteBoardOpen &&
                                        <span style={{ display: 'initial' }}>
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
                        <button id="joinBtn" disabled={isCalling || !isAuthorized} onClick={startVideoCall}>
                            {
                                !isCalling ? "Join Meeting" : (isJoined ? "Waiting for peer to Join" : "Joining")
                            }
                        </button>
                    }
                    {
                        (isCalling || isCallStarted) &&
                        <button id="hangupButton" onClick={endVideoCall}>
                            <i className="la la-phone"></i>
                        </button>
                    }
                    {
                        isCallStarted &&
                        <>
                            <button className="operation-btn" onClick={toggleMicrophone} >
                                <i className={isLocalAudioSharing ? "la la-microphone" : "las la-microphone-slash"} ></i>
                            </button>
                            <button className="operation-btn" onClick={toggleVideo} >
                                <i className={isLocalVideoSharing ? "la la-video" : "las la-video-slash"} ></i>
                            </button>
                            <button className="operation-btn" onClick={toggleScreenShare} >
                                <i className={isLocalScreenSharing ? "las la-desktop" : "las la-camera"} ></i>
                            </button>
                            {
                                isLocalVideoHidden &&
                                <button className="operation-btn" onClick={showLocalVideo} >
                                    <i className="lab la-creative-commons-by"></i>
                                </button>
                            }
                            <button className="operation-btn" id="boardBtn" onClick={toggleBoard} >
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

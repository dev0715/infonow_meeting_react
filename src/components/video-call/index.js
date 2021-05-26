import React, { useEffect, useState } from 'react'
import io from "socket.io-client"
import { Row, Col } from 'reactstrap'

import './style.css';
import { IOEvents } from "./events"
import { servers, VideoSharingConfig, ScreenSharingConfig, IOConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';



let videoContainer = null;

let webcamVideoContainer = null;
let webcamVideo = null;
let remoteVideo = null;
let joinBtn = null;
let hangupButton = null;
let muteAudioBtn = null;
let muteVideoBtn = null;
let hideLocalVideoBtn = null;
let showLocalVideoBtn = null;
let screenShareBtn = null;
let whiteBoard = null;
let boardBtn = null;
let isBoardVisible = false;
let isRemoteVideoMuted = false;

let indicatorContainer = null;
let userAudioMuteIndicator = null;
let userVideoMuteIndicator = null;
let userScreenSharingMuteIndicator = null;

let callBtnContainer = null;


// Global State
let pc = null;
let localStream = null;
let remoteStream = null;
let toggleStreamObj = null;

var candidates = [];

let isJoined = false;
let isScreenShared = false;

let socket;

let user = {};

export const VideoCall = () => {

    const [micIcon, setMicIcon] = useState("la la-microphone");
    const [videoIcon, setVideoIcon] = useState("la la-video");
    const [screenIcon, setScreenIcon] = useState("las la-desktop");
    const [boardIcon, setBoardIcon] = useState("las la-pencil-alt");

    const [isRemoteBoardOpen, setRemoteBoardOpen] = useState(false);


    const [remoteUser, setRemoteUser] = useState({});


    const { token, meetingId, lang } = useParams();

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
            hangupButton.click()
        });

        socket.on(IOEvents.AUTHORIZATION, function (res) {
            console.log(IOEvents.AUTHORIZATION, res)
            //------------static for testing ----------//
            if (!res.success) {
                joinBtn.disabled = true
                toast("You are not authorized")
            } else {
                user = res.data;
                toast(`Welcome ${user.name}, you are successfully authorized`)
                joinBtn.disabled = false
            }

        });

        socket.on(IOEvents.ALREADY_JOINED, function (res) {
            console.log(IOEvents.ALREADY_JOINED, res)
            hangupButton.click()
            toast(res.message)
        });

        socket.on(IOEvents.INVALID_PARTICIPANT, function (res) {
            console.log(IOEvents.INVALID_PARTICIPANT, res)
            hangupButton.click()
            toast(res.message, 5000)
        });

        socket.on(IOEvents.MEETING_NOT_FOUND, function (res) {
            console.log(IOEvents.MEETING_NOT_FOUND, res)
            hangupButton.click()
            toast(res.message, 5000)
        });

        socket.on(IOEvents.MEETING_NOT_ACTIVE, function (res) {
            console.log(IOEvents.MEETING_NOT_ACTIVE, res)
            hangupButton.click()
            toast(res.message, 5000)
        });

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

        socket.on(IOEvents.ROOM_NOT_FOUND, function (res) {
            console.log(IOEvents.ROOM_NOT_FOUND, res)
            toast(res.message)

            endVideoCall()

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
            if (!data) {
                console.log("ROOM_JOIN return", data)
                return
            }
            console.log("ROOM_JOIN")

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

        });

        socket.on(IOEvents.JOINED_ROOM_AS_RECEIVER, function (res) {
            console.log(IOEvents.JOINED_ROOM_AS_RECEIVER)
            setRemoteUser(res.data);
            toast(`${res.data.name} has already joined the meeting`)
            isJoined = true;
        });

        socket.on(IOEvents.CALL_ON_WAIT, function () {
            console.log(IOEvents.CALL_ON_WAIT)
            joinBtn.innerHTML = "Waiting for peer to Join"
            isJoined = true;
        });

        socket.on(IOEvents.START_CALL, () => {

            console.log(IOEvents.START_CALL)
            setupIceEventOnStartCall()

            joinBtn.style.display = "none";
            indicatorContainer.style.display = "initial"
            muteVideoBtn.style.display = "initial";
            muteAudioBtn.style.display = "initial";
            screenShareBtn.style.display = "initial";
            boardBtn.style.display = "initial";


            joinBtn.disabled = false;
            webcamVideo.classList.add("active");
            remoteVideo.classList.add("active");

            hideLocalVideoBtn.style.display = "initial";

            videoContainer.classList.add("active");

        });

        socket.on(IOEvents.MUTE_AUDIO, function () {
            console.log(IOEvents.MUTE_AUDIO)
            userAudioMuteIndicator.style.display = "initial";
        });

        socket.on(IOEvents.UNMUTE_AUDIO, function () {
            console.log(IOEvents.UNMUTE_AUDIO)
            userAudioMuteIndicator.style.display = "none";
        });

        socket.on(IOEvents.MUTE_VIDEO, function () {
            console.log(IOEvents.MUTE_VIDEO)
            isRemoteVideoMuted = true
            userVideoMuteIndicator.style.display = "initial";
            if (!isBoardVisible) {
                onMuteRemoteVideo()
            }
        });

        socket.on(IOEvents.UNMUTE_VIDEO, function () {
            console.log(IOEvents.UNMUTE_VIDEO)
            isRemoteVideoMuted = false
            userVideoMuteIndicator.style.display = "none";

            if (!isBoardVisible) {
                onUnmuteRemoteVideo()
            }

        });

        socket.on(IOEvents.SCREEN_SHARING, function () {
            console.log(IOEvents.SCREEN_SHARING)
            userScreenSharingMuteIndicator.style.display = "initial";
        });

        socket.on(IOEvents.VIDEO_SHARING, function () {
            console.log(IOEvents.VIDEO_SHARING)
            userScreenSharingMuteIndicator.style.display = "none";
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

    function onMuteRemoteVideo() {
        webcamVideo.classList.remove("active");
        remoteVideo.classList.remove("active");
        hideLocalVideoBtn.style.display = "none";
        webcamVideo.style.display = "initial";
        showLocalVideoBtn.style.display = "none";
    }

    function onUnmuteRemoteVideo() {
        webcamVideo.classList.add("active");
        remoteVideo.classList.add("active");
        hideLocalVideoBtn.style.display = "initial";
    }

    function init() {

        initSocket()

        // HTML elements
        videoContainer = document.getElementById('videos');
        webcamVideoContainer = document.getElementById('webcamVideoContainer');
        webcamVideo = document.getElementById('webcamVideo');
        remoteVideo = document.getElementById('remoteVideo');
        joinBtn = document.getElementById('joinBtn');
        hangupButton = document.getElementById('hangupButton');
        muteAudioBtn = document.getElementById('muteMic');
        muteVideoBtn = document.getElementById('muteVideo');
        whiteBoard = document.getElementById("whiteBoard");
        boardBtn = document.getElementById('boardBtn');
        hideLocalVideoBtn = document.getElementById('hideLocalVideoBtn');
        showLocalVideoBtn = document.getElementById('showLocalVideoBtn');
        screenShareBtn = document.getElementById('screenShareBtn');
        indicatorContainer = document.getElementById("indicator-container")
        userAudioMuteIndicator = document.getElementById('user-audio-icon');
        userVideoMuteIndicator = document.getElementById('user-video-icon');
        userScreenSharingMuteIndicator = document.getElementById('user-screen-sharing-icon');
        callBtnContainer = document.getElementById('btn-video-call-container');
        joinBtn.onclick = startVideoCall;
        hangupButton.onclick = endVideoCall
        muteAudioBtn.onclick = toggleMicrophone
        muteVideoBtn.onclick = toggleVideo
        screenShareBtn.onclick = toggleScreenShare
        boardBtn.onclick = toggleBoard


        hideLocalVideoBtn.onclick = () => {
            hideLocalVideoBtn.style.display = "none";
            webcamVideo.style.display = "none";
            showLocalVideoBtn.style.display = "initial";
        }

        showLocalVideoBtn.onclick = () => {
            hideLocalVideoBtn.style.display = "initial";
            webcamVideo.style.display = "initial";
            showLocalVideoBtn.style.display = "none";
        }
    }

    useEffect(() => {
        init()
    }, [])


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

        // pc.oniceconnectionstatechange = function () {
        //     if (pc.iceConnectionState == 'disconnected') {
        //         console.log(' user Disconnected');
        //         hangupButton.click()
        //     }
        // }
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
            remoteVideo.srcObject = null
        } catch (error) {
            console.log("CLOSING REMOTE STREAM")
        }

    }

    function closeLocalStream() {
        try {
            localStream.getAudioTracks()[0].stop();
            localStream.getVideoTracks()[0].stop();
            webcamVideo.srcObject = null
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

        webcamVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;

        joinBtn.innerHTML = "Joining"
        hangupButton.style.display = "initial";
    }

    // DONE
    function resetScreenAndButtons() {

        setRemoteUser({})

        joinBtn.innerHTML = "Join Meeting"
        joinBtn.disabled = false;
        joinBtn.style.display = "initial";
        hangupButton.style.display = "none";
        muteVideoBtn.style.display = "none";
        muteAudioBtn.style.display = "none";
        screenShareBtn.style.display = "none";

        isBoardVisible = false;
        whiteBoard.style.display = "none";
        boardBtn.style.display = "none";
        showLocalVideoBtn.style.display = "none";
        hideLocalVideoBtn.style.display = "none";

        // Video Views
        webcamVideo.classList.remove("active");
        remoteVideo.classList.remove("active");
        remoteVideo.style.display = "initial";

        webcamVideo.style.display = "initial";
        webcamVideoContainer.style.display = "initial";

        // Mute indicators
        indicatorContainer.style.display = "none"
        userAudioMuteIndicator.style.display = "none";
        userVideoMuteIndicator.style.display = "none";
        userScreenSharingMuteIndicator.style.display = "none";

        // Mute Buttons
        setMicIcon("la la-microphone");
        setVideoIcon("la la-video")
        setScreenIcon("las la-desktop")
        setScreenIcon("las la-desktop")
        setBoardIcon("las la-pencil-alt")
        setRemoteBoardOpen(false)

        // Enabling display of hoverable controls
        callBtnContainer.style.display = "block"
        videoContainer.classList.remove("active");
    }


    function toggleBoard() {

        if (isBoardVisible) {
            whiteBoard.style.display = "none"
            setBoardIcon("las la-pencil-alt")
            remoteVideo.style.display = "initial";
            if (isRemoteVideoMuted) {
                onMuteRemoteVideo()
            }
            socket.emit(IOEvents.CLOSE_BOARD)
        } else {
            if (isRemoteVideoMuted) {
                onUnmuteRemoteVideo()
            }
            remoteVideo.style.display = "none";
            whiteBoard.style.display = "initial"
            setBoardIcon("las la-pencil-ruler")
            whiteBoard.src = getWhiteboardUrl(meetingId, user.userId);
            socket.emit(IOEvents.OPEN_BOARD)
        }
        isBoardVisible = !isBoardVisible
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
        if (localStream.getAudioTracks()[0].enabled) {

            setMicIcon("la la-microphone")
            socket.emit(IOEvents.UNMUTE_AUDIO);
        } else {

            setMicIcon("las la-microphone-slash")
            socket.emit(IOEvents.MUTE_AUDIO);
        }
    }

    function toggleVideo() {
        localStream.getVideoTracks()[0].enabled = !(localStream.getVideoTracks()[0].enabled);
        if (localStream.getVideoTracks()[0].enabled) {

            webcamVideoContainer.style.display = "initial";
            setVideoIcon("la la-video")
            socket.emit(IOEvents.UNMUTE_VIDEO);
        } else {

            webcamVideoContainer.style.display = "none";
            setVideoIcon("las la-video-slash");
            socket.emit(IOEvents.MUTE_VIDEO);
        }
    }

    async function toggleScreenShare() {

        try {
            if (isScreenShared) {

                toggleStreamObj = await navigator.mediaDevices.getUserMedia(VideoSharingConfig);

                setScreenIcon("las la-desktop")
                isScreenShared = false;
            } else {
                toggleStreamObj = await navigator.mediaDevices.getDisplayMedia(ScreenSharingConfig);
                setScreenIcon("las la-camera")
                isScreenShared = true;
            }
            let videoTrack = toggleStreamObj.getVideoTracks()[0];

            var sender = pc.getSenders().find(function (s) {
                return s.track.kind == videoTrack.kind;
            });
            sender.replaceTrack(videoTrack);
            videoTrack.onended = () => {
                toggleScreenShare()
            }

            webcamVideo.srcObject = toggleStreamObj;
            if (isScreenShared) {
                socket.emit(IOEvents.SCREEN_SHARING)
            } else {
                socket.emit(IOEvents.VIDEO_SHARING)
            }

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
        joinBtn.disabled = true;
        initVideoState()
        setTimeout(createRoom, 1000);
    }

    function endVideoCall() {
        closeConnection()
        resetScreenAndButtons()

        if (isJoined) {
            socket.emit(IOEvents.END_CALL);
        }
        isJoined = false
    }


    return (
        <Row>
            <Col lg={12} id="videos">
                <span id="webcamVideoContainer">
                    <video id="webcamVideo" muted="muted" autoPlay={true} playsInline style={{ objectFit: 'contain' }}></video>
                    <button id="hideLocalVideoBtn" style={{ display: 'none' }}>
                        <i className="la la-close"></i>
                    </button>
                </span>
                <span>
                    <video id="remoteVideo" autoPlay={true} playsInline style={{ objectFit: 'contain' }}></video>
                </span>
                <iframe id="whiteBoard" src="" style={{ display: 'none' }}>
                </iframe>
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
                            <span id="user-audio-icon" >
                                <i className="la la-microphone-slash "></i>
                            </span>
                            <span id="user-video-icon"  >
                                <i className="las la-video-slash "></i>
                            </span>
                            <span id="user-screen-sharing-icon" >
                                <i className="las la-desktop "></i>
                            </span>
                            {
                                isRemoteBoardOpen &&
                                <>
                                    <span style={{ display: 'initial' }}>
                                        <i className="las la-pencil-alt"></i>
                                    </span>
                                </>
                            }
                        </div>

                    </div>


                </div>
                <div id="btn-video-call-container">
                    <button id="joinBtn">Join Meeting</button>
                    <button id="hangupButton" style={{ display: "none" }}>
                        <i className="la la-phone"></i>
                    </button>
                    <button className="operation-btn" id="muteMic" style={{ display: 'none' }}>
                        <i className={micIcon}></i>
                    </button>
                    <button className="operation-btn" id="muteVideo" style={{ display: 'none' }}>
                        <i className={videoIcon}></i>
                    </button>
                    <button className="operation-btn" id="screenShareBtn" style={{ display: 'none' }}>
                        <i className={screenIcon}></i>
                    </button>
                    <button className="operation-btn" id="showLocalVideoBtn" style={{ display: 'none' }}>
                        <i className="lab la-creative-commons-by"></i>
                    </button>
                    <button className="operation-btn" id="boardBtn" style={{ display: 'none' }}>
                        <i className={boardIcon}></i>
                    </button>
                </div>
                <div className="text-center">
                    <div id="snackbar"></div>
                </div>
            </Col>
        </Row >
    );

}

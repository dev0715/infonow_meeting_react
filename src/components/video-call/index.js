import React, { useEffect, useState } from 'react'
import io from "socket.io-client"
import { Row, Col } from 'reactstrap'

import './style.css';
import { IOEvents } from "./events"
import { servers, videoSharingConfig, screenSharingConfig } from './config';


export const VideoCall = () => {

    const [micIcon, setMicIcon] = useState("la la-microphone");
    const [videoIcon, setVideoIcon] = useState("la la-video");
    const [screenIcon, setScreenIcon] = useState("las la-desktop");


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

    let userAudioMuteIndicator = null;
    let userVideoMuteIndicator = null;
    let userScreenSharingMuteIndicator = null;

    let callBtnContainer = null;

    let callInput = null;
    let userInput = null;

    // Global State
    var pc = null;
    let localStream = null;
    let remoteStream = null;
    let toggleStreamObj = null;

    var candidates = [];

    let isJoined = false;
    let isScreenShared = false;

    var meetingId = "3aad1303-cda3-431b-a171-5e3ddc14af3d"
    var userId = "af59250f-d07a-423c-ba44-35a6143a18eb";

    var socket;


    function init() {
        socket = io('http://192.168.10.101:3601', { transports: ['websocket', 'polling', 'flashsocket'] });


        socket.on(IOEvents.CONNECT, function () {
            console.log(IOEvents.CONNECT)
            socket.emit(IOEvents.AUTHORIZATION)
        });

        socket.on(IOEvents.SET_LANGUAGE, function () {
            console.log(IOEvents.SET_LANGUAGE)
            socket.emit(IOEvents.SET_LANGUAGE, {
                locale: "en"
            })

        });

        socket.on(IOEvents.END_CALL, function () {
            console.log(IOEvents.END_CALL)
            hangupButton.click()

        });

        socket.on(IOEvents.AUTHORIZATION, function () {
            console.log(IOEvents.AUTHORIZATION)
            //------------static for testing ----------//

        });

        socket.on(IOEvents.ALREADY_JOINED, function (res) {
            hangupButton.click()
            toast(res.message)
        });

        socket.on(IOEvents.INVALID_PARTICIPANT, function (res) {

            hangupButton.click()
            toast(res.message, 5000)
        });

        socket.on(IOEvents.MEETING_NOT_FOUND, function (res) {
            console.log(IOEvents.MEETING_NOT_FOUND)
            hangupButton.click()
            toast(res.message, 5000)
        });

        socket.on(IOEvents.MEETING_NOT_ACTIVE, function (res) {

            hangupButton.click()
            toast(res.message, 5000)
        });

        socket.on(IOEvents.ROOM_EXIST, function () {

            console.log(IOEvents.ROOM_EXIST)

            closeLocalStream()
            pc.close()

            setTimeout(() => {

                initVideoState()
                joinRoom()
            }, 200);

        });

        socket.on(IOEvents.ROOM_NOT_FOUND, function (res) {
            toast(res.message)

            endVideoCall()

        });

        socket.on(IOEvents.CREATE_ICE_EVENT_DATA, (data) => {

            if (data) {
                console.log(IOEvents.CREATE_ICE_EVENT_DATA);
                const candidate = new RTCIceCandidate(data);
                pc.addIceCandidate(candidate);
            }

        });

        socket.on(IOEvents.RECEIVE_ANSWER, (data) => {

            if (!pc.currentRemoteDescription && data) {
                console.log(IOEvents.RECEIVE_ANSWER);
                const answerDescription = new RTCSessionDescription(data);
                pc.setRemoteDescription(answerDescription);
                socket.emit(IOEvents.START_CALL, {
                    type: IOEvents.RECEIVE_ANSWER
                });
            }

        });

        socket.on(IOEvents.ROOM_JOIN, async (data) => {

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

            setupIceEventBeforeStartCall()

        });

        socket.on(IOEvents.JOINED_ROOM_AS_RECEIVER, function () {
            console.log(IOEvents.JOINED_ROOM_AS_RECEIVER)
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
            muteVideoBtn.style.display = "initial";
            muteAudioBtn.style.display = "initial";
            screenShareBtn.style.display = "initial";


            joinBtn.disabled = false;
            webcamVideo.classList.add("active");
            remoteVideo.classList.add("active");

            hideLocalVideoBtn.style.display = "initial";
            callBtnContainer.style.display = "none";

            videoContainer.onmouseover = () => {
                callBtnContainer.style.display = "block";
            }

            callBtnContainer.onmouseover = () => {
                callBtnContainer.style.display = "block";
            }

            videoContainer.onmouseout = () => {
                callBtnContainer.style.display = "none";
            }

            callBtnContainer.onmouseout = () => {
                callBtnContainer.style.display = "none";
            }

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
            webcamVideo.classList.remove("active");
            remoteVideo.classList.remove("active");
            userVideoMuteIndicator.style.display = "initial";

            hideLocalVideoBtn.style.display = "none";
            webcamVideo.style.display = "initial";
            showLocalVideoBtn.style.display = "none";

        });

        socket.on(IOEvents.UNMUTE_VIDEO, function () {
            console.log(IOEvents.UNMUTE_VIDEO)

            webcamVideo.classList.add("active");
            remoteVideo.classList.add("active");
            userVideoMuteIndicator.style.display = "none";

            hideLocalVideoBtn.style.display = "initial";

        });

        socket.on(IOEvents.SCREEN_SHARING, function () {
            console.log(IOEvents.SCREEN_SHARING)

            userScreenSharingMuteIndicator.style.display = "initial";

        });

        socket.on(IOEvents.VIDEO_SHARING, function () {
            console.log(IOEvents.VIDEO_SHARING)

            userScreenSharingMuteIndicator.style.display = "none";

        });


        // HTML elements
        videoContainer = document.getElementById('videos');
        webcamVideoContainer = document.getElementById('webcamVideoContainer');
        webcamVideo = document.getElementById('webcamVideo');
        remoteVideo = document.getElementById('remoteVideo');
        joinBtn = document.getElementById('joinBtn');
        hangupButton = document.getElementById('hangupButton');
        muteAudioBtn = document.getElementById('muteMic');
        muteVideoBtn = document.getElementById('muteVideo');
        hideLocalVideoBtn = document.getElementById('hidelocalViewBtn');
        showLocalVideoBtn = document.getElementById('showLocalVideoBtn');

        screenShareBtn = document.getElementById('screenShareBtn');

        userAudioMuteIndicator = document.getElementById('user-audio-icon');
        userVideoMuteIndicator = document.getElementById('user-video-icon');
        userScreenSharingMuteIndicator = document.getElementById('user-screen-sharing-icon');

        callBtnContainer = document.getElementById('btn-video-call-container');

        callInput = document.getElementById('callInput');
        userInput = document.getElementById('userInput');

        callInput.value = meetingId;
        userInput.value = userId;

        joinBtn.onclick = () => {

            startVideoCall()

        };

        hangupButton.onclick = () => {

            endVideoCall()
        }

        muteAudioBtn.onclick = () => {
            toggleMicrophone()
        }

        muteVideoBtn.onclick = () => {
            toggleVideo()
        }

        screenShareBtn.onclick = () => {
            toggleScreenShare();
        }

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

        pc.oniceconnectionstatechange = function () {
            if (pc.iceConnectionState == 'disconnected') {
                console.log(' user Disconnected');
                hangupButton.click()
            }
        }
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

    async function initCamera() {

        localStream = await navigator.mediaDevices.getUserMedia(videoSharingConfig);
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

    function resetScreenAndButtons() {

        joinBtn.innerHTML = "Join Meeting"
        joinBtn.disabled = false;
        joinBtn.style.display = "initial";
        hangupButton.style.display = "none";
        muteVideoBtn.style.display = "none";
        muteAudioBtn.style.display = "none";
        screenShareBtn.style.display = "none";
        showLocalVideoBtn.style.display = "none";
        hideLocalVideoBtn.style.display = "none";

        // Video Views
        webcamVideo.classList.remove("active");
        remoteVideo.classList.remove("active");

        webcamVideo.style.display = "initial";
        webcamVideoContainer.style.display = "initial";

        // Mute indicators
        userAudioMuteIndicator.style.display = "none";
        userVideoMuteIndicator.style.display = "none";
        userScreenSharingMuteIndicator.style.display = "none";

        // Mute Buttons
        setVideoIcon("la la-video")
        setScreenIcon("las la-desktop")
        setScreenIcon("las la-desktop")

        // Enabling display of hoverable controlls
        callBtnContainer.style.display = "block"
        videoContainer.onmouseover = null;
        videoContainer.onmouseout = null;
        callBtnContainer.onmouseover = null;
        callBtnContainer.onmouseout = null;
    }

    function createRoom() {

        initCamera()

        setTimeout(async () => {

            const offerDescription = await pc.createOffer();
            await pc.setLocalDescription(offerDescription);

            socket.emit(IOEvents.CREATE_ROOM, {
                type: IOEvents.CREATE_ROOM,
                meetingId: meetingId,
                userId: userId,
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

                toggleStreamObj = await navigator.mediaDevices.getUserMedia(videoSharingConfig);

                setScreenIcon("las la-desktop")
                isScreenShared = false;
            } else {
                toggleStreamObj = await navigator.mediaDevices.getDisplayMedia(screenSharingConfig);
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

        meetingId = callInput.value;
        userId = userInput.value;

        if (!meetingId || !userId) {
            toast("Please fill the form")
            return
        }

        joinBtn.disabled = true;

        initVideoState()

        setTimeout(() => {
            createRoom()
        }, 1000);
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
                    <video id="webcamVideo" muted="muted" autoPlay={true} playsinline style={{ objectFit: 'contain' }}></video>
                    <button id="hidelocalViewBtn" style={{ display: 'none' }}>
                        <i className="la la-close"></i>
                    </button>
                </span>
                <span>
                    <video id="remoteVideo" autoPlay={true} playsinline style={{ objectFit: 'contain' }}></video>
                </span>
                <div className="indicator-container">
                    <span id="user-audio-icon" className="user-indicators-icon">
                        <i className="la la-user"></i>
                        <i className="la la-microphone-slash "></i>
                    </span>
                    <span id="user-video-icon" className="user-indicators-icon">
                        <i className="la la-user"></i>
                        <i className="las la-video-slash "></i>
                    </span>
                    <span id="user-screen-sharing-icon" className="user-indicators-icon">
                        <i className="la la-user"></i>
                        <i className="las la-desktop "></i>
                    </span>
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
                        <i class="lab la-creative-commons-by"></i>
                    </button>
                </div>

            </Col>
            <Col className=" mt-3 mb-3 d-flex justify-content-center">
                <div className="col-sm-12 col-md-6 col-lg-4 text-center ">
                    <div class="form-group ">
                        <label for="callInput">Meeting ID</label>
                        <input type="text" class="form-control" id="callInput" placeholder="Enter meeting id" />
                    </div>

                    <div class="form-group">
                        <label for="userInput">User ID</label>
                        <input type="text" class="form-control" id="userInput" placeholder="Enter user id" />
                    </div>
                </div>
                <div id="snackbar">Some message</div>
            </Col>
        </Row >);

}

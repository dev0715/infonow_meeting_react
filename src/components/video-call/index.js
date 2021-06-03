

import React, { useEffect, useState } from 'react'
import io from "socket.io-client"
import Select from 'react-select'
import './style.css';
import { IOEvents } from "./events"
import { servers, IOConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';
import { getConnectedDevices, removeAllAudioTracks, removeAllVideoTracks, setNewAudioTrack, setNewVideoTrack } from './stream';
import { audioScale, getNameInitials } from './utils';
import { SoundMeter } from './sound-meter'

const icBrush = require('../../images/brush.svg').default;
const icMicSlash = require('../../images/mic-slash.svg').default;
const icMic = require('../../images/mic.svg').default;
const icPhoneOff = require('../../images/phone-off.svg').default;
const icPhoneOn = require('../../images/phone-on.svg').default;
const icPortrait = require('../../images/portrait.svg').default;
const icScreenSharingSlash = require('../../images/screensharing-slash.svg').default;
const icScreenSharing = require('../../images/screensharing.svg').default;
const icVideoSlash = require('../../images/video-slash.svg').default;
const icVideo = require('../../images/video.svg').default;
const icLoader = require('../../images/loader.png').default;
const icTimes = require('../../images/times.svg').default;



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

let soundMeter;
let meterRefresh;

let mediaDevices = [];



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
    const [remoteAudioReading, setRemoteAudioReading] = useState(0);

    const [isLocalAudioSharing, setLocalAudioSharing] = useState(false);
    const [isLocalVideoSharing, setLocalVideoSharing] = useState(false);
    const [isLocalScreenSharing, setLocalScreenSharing] = useState(false);

    const [isLocalBoardOpen, setLocalBoardOpen] = useState(false);
    const [boardUrl, setBoardUrl] = useState(null);


    const [isDevicesChanged, setDevicesChanged] = useState(false);
    const [micDeviceId, setMicDeviceId] = useState('default');
    const [cameraDeviceId, setCameraDeviceId] = useState('default');

    const [isAudioDeviceModelHidden, setAudioDeviceModelHidden] = useState(true);
    const [isVideoDeviceModelHidden, setVideoDeviceModelHidden] = useState(true);

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
                setAuthorized(true)
                if (isCallStarted) {
                    console.log("RECONNECTING")
                    socket.emit(IOEvents.RECONNECTING, { meetingId: meetingId })
                } else {
                    setUser(res.data);
                    initLocalStream();
                }
            }
            else {
                setAuthorized(false)
                setUser({});
                toast("You are not authorized")
            }
        });

        socket.on(IOEvents.REJOIN_ROOM, res => {
            if (res.success) {
                toast("Reconnected")
            } else {
                endVideoCall()
            }
        })

        socket.on(IOEvents.NEW_OFFER, async (res) => {
            console.log(IOEvents.NEW_OFFER, res);
            if (res.data) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                const answerDescription = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answerDescription);
                //----------------------------------------//
                //---------------SEND ANSWER-------------//
                //--------------------------------------//
                socket.emit(IOEvents.NEW_ANSWER, {
                    type: IOEvents.NEW_ANSWER,
                    data: {
                        type: answerDescription.type,
                        sdp: answerDescription.sdp,
                    }
                });
            }
        });

        socket.on(IOEvents.NEW_ANSWER, res => {
            console.log(IOEvents.NEW_ANSWER, res);
            if (res.data) {
                console.log(IOEvents.NEW_ANSWER);
                const answerDescription = new RTCSessionDescription(res.data);
                peerConnection.setRemoteDescription(answerDescription);
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
            // closeLocalStream()
            peerConnection.close()
            setTimeout(() => {
                initPeerConnection()
                // candidates = []
                // setupIceEventBeforeStartCall()
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
            endVideoCall()
        });

        socket.on(IOEvents.MUTE_AUDIO, function () {
            console.log(IOEvents.MUTE_AUDIO)
            setRemoteMicMute(true)
            endSoundMeter()
            setRemoteAudioReading(0)
        });

        socket.on(IOEvents.UNMUTE_AUDIO, function () {
            console.log(IOEvents.UNMUTE_AUDIO)
            setRemoteMicMute(false);
            startSoundMeter()
        });

        socket.on(IOEvents.MUTE_VIDEO, function () {
            console.log(IOEvents.MUTE_VIDEO)
            setRemoteVideoMute(true)
        });

        socket.on(IOEvents.UNMUTE_VIDEO, function () {
            console.log(IOEvents.UNMUTE_VIDEO)
            setRemoteVideoMute(false)

        });

        socket.on(IOEvents.SCREEN_SHARING_ENABLED, function () {
            console.log(IOEvents.SCREEN_SHARING_ENABLED)
            setRemoteScreenSharingEnabled(true)
        });

        socket.on(IOEvents.SCREEN_SHARING_DISABLED, function () {
            console.log(IOEvents.SCREEN_SHARING_DISABLED)
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

    function startSoundMeter() {
        if (remoteStream.getAudioTracks().length > 0) {
            soundMeter = new SoundMeter(new AudioContext());
            soundMeter.connectToSource(remoteStream, function (e) {
                if (e) {
                    console.log("START_SOUND_METER_ERROR", e);
                    return;
                }
                meterRefresh = setInterval(() => {
                    setRemoteAudioReading(soundMeter.instant)
                }, 100);
            });
        } else {
            setTimeout(startSoundMeter, 2000);
        }
    }

    function endSoundMeter() {
        if (soundMeter)
            soundMeter.stop()
        if (meterRefresh)
            clearInterval(meterRefresh);
    }

    function endCallOnReload() {
        console.log("Page Reloading")
        socket.emit(IOEvents.END_CALL)
        window.removeEventListener("beforeunload", endCallOnReload);
    }

    async function createOffer() {
        if (peerConnection) {
            const offerDescription = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offerDescription);

            socket.emit(IOEvents.NEW_OFFER, {
                data: {
                    sdp: offerDescription.sdp,
                    type: offerDescription.type,
                }
            });
            console.log("CREATING RE-NEGOTIATION OFFER");
        }
    }

    async function init() {

        getMediaDevices()
        initSocket()
        window.addEventListener("beforeunload", endCallOnReload);
    }

    useEffect(init, [])
    useEffect(() => {
        console.log("IS_DEVICES_CHANGED", isDevicesChanged)
        if (isDevicesChanged) {
            refreshMediaDevices()
        }
    }, [isDevicesChanged])


    async function getMediaDevices() {
        try {
            mediaDevices = await getConnectedDevices();
            console.log("Media_Devices", mediaDevices)
            navigator.mediaDevices.addEventListener('devicechange', event => {
                console.log("Device_Change_Detected", event)
                setDevicesChanged(isDevicesChanged => !isDevicesChanged)
            });
        } catch (error) {
            console.log("MEDIA_DEVICES_ERROR", error)
        }
    }


    async function refreshMediaDevices() {

        mediaDevices = await getConnectedDevices();
        console.log("Mic_ON", isLocalAudioSharing)
        console.log("WebCam_ON", isLocalVideoSharing)
        if (isLocalAudioSharing) {
            if (!mediaDevices.find(m => m.deviceId === micDeviceId)) toggleMicrophone();
        }
        if (isLocalVideoSharing) {
            if (!mediaDevices.find(m => m.deviceId === cameraDeviceId)) toggleVideo();
        }
        setDevicesChanged(false)
    }

    function getAudioMediaDevices() {
        return mediaDevices.filter(device => device.kind === 'audioinput')
    }

    function getVideoMediaDevices() {
        return mediaDevices.filter(device => device.kind === 'videoinput')
    }


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
            remoteStream = new MediaStream();

            setupIceEventBeforeStartCall()

            peerConnection.onnegotiationneeded = createOffer;
            // Push tracks from local stream to peer connection
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });

            // Pull tracks from remote stream, add to video stream
            peerConnection.ontrack = (event) => {
                event.streams[0].getTracks().forEach((track) => {
                    console.log("NEW " + track.kind + " TRACK ADDED TO REMOTE STREAM");
                    remoteStream.addTrack(track);
                });
            };
            remoteVideoRef.current.srcObject = remoteStream
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
        candidates = []
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
        peerConnection = null
    }

    async function initLocalStream() {
        try {
            localStream = new MediaStream();
            webcamVideoRef.current.srcObject = localStream
        } catch (error) {
            console.log("INIT_LOCAL_STREAM_ERROR", error)
        }
    }

    function toggleBoard() {
        socket.emit(isLocalBoardOpen ? IOEvents.CLOSE_BOARD : IOEvents.OPEN_BOARD)
        setBoardUrl(isLocalBoardOpen ? null : getWhiteboardUrl(meetingId, user.userId))
        setLocalBoardOpen(isLocalBoardOpen => !isLocalBoardOpen)

    }

    function createRoom() {
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
                // setupIceEventBeforeStartCall()
            } catch (error) {
                console.log("CREATE_ROOM_FUNCTION_ERROR", error)
            }
        }, 1000);
    }

    function joinRoom() {
        setTimeout(async () => {
            socket.emit(IOEvents.ROOM_JOIN, {
                type: IOEvents.ROOM_JOIN,
                meetingId: meetingId,
            });

        }, 1000);
    }

    function sendInitialEvents() {
        if (socket && isCallStarted) {
            console.log(`Local audio==>${isLocalAudioSharing}, Local video==>${isLocalVideoSharing}`)
            socket.emit(isLocalAudioSharing ? IOEvents.UNMUTE_AUDIO : IOEvents.MUTE_AUDIO)
            socket.emit(isLocalVideoSharing ? IOEvents.UNMUTE_VIDEO : IOEvents.MUTE_VIDEO)
        }
    }

    useEffect(sendInitialEvents, [isCallStarted])

    async function toggleMicrophone() {
        console.log("MIC_ID", micDeviceId)
        try {
            if (isLocalAudioSharing) {
                removeAllAudioTracks(peerConnection, localStream);
            }
            else {
                let failed = await setNewAudioTrack(peerConnection, localStream, micDeviceId)
                if (failed) throw failed;
            }
            socket.emit(isLocalAudioSharing ? IOEvents.MUTE_AUDIO : IOEvents.UNMUTE_AUDIO)
            setLocalAudioSharing(isLocalAudioSharing => !isLocalAudioSharing)
        } catch (error) {
            console.log(error)
            toast("MicroPhone is not enabled")
        }
    }

    useEffect(() => {
        console.log("IS_LOCAL_SCREEN_SHARING", isLocalScreenSharing, isLocalScreenSharingFlag)
    }, [isLocalScreenSharing])

    useEffect(() => {
        console.log("IS_LOCAL_VIDEO_SHARING", isLocalVideoSharing)
    }, [isLocalVideoSharing])


    async function toggleVideo() {
        console.log("CAM_ID", cameraDeviceId)

        try {
            stopScreenStream()

            if (isLocalVideoSharing) {
                removeAllVideoTracks(peerConnection, localStream);
                webcamVideoRef.current.srcObject = null
            }
            else {
                let failed = await setNewVideoTrack(peerConnection, localStream, 'webcam', cameraDeviceId)
                if (failed) throw "TOGGLE_VIDEO_TO_TRUE_FAILED " + failed
                webcamVideoRef.current.srcObject = localStream
            }
            socket.emit(isLocalVideoSharing ? IOEvents.MUTE_VIDEO : IOEvents.UNMUTE_VIDEO)
            setLocalVideoSharing(isLocalVideoSharing => !isLocalVideoSharing)
        } catch (error) {
            console.log(error)
            toast("Camera is not enabled")
        }

    }

    async function stopWebcamStream() {
        if (isLocalVideoSharing) {
            removeAllVideoTracks(peerConnection, localStream);
            webcamVideoRef.current.srcObject = null
            socket.emit(IOEvents.MUTE_VIDEO)
            setLocalVideoSharing(false)
        }
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
                let failed = await setNewVideoTrack(peerConnection, localStream, 'screen', null, toggleScreenShare)
                if (failed) {
                    webcamVideoRef.current.srcObject = isLocalVideoSharing ? localStream : null
                    throw "Screen Share Cancelled. " + failed
                }
                webcamVideoRef.current.srcObject = localStream
            }

            isLocalScreenSharingFlag = !isLocalScreenSharingFlag
            socket.emit(isLocalScreenSharingFlag ? IOEvents.SCREEN_SHARING_ENABLED : IOEvents.SCREEN_SHARING_DISABLED)
            setLocalScreenSharing(isLocalScreenSharingFlag)

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
        setRemoteAudioReading(0)

        setLocalAudioSharing(false)
        setLocalVideoSharing(false)
        setLocalScreenSharing(false)
        isLocalScreenSharingFlag = false

        setLocalBoardOpen(false)
        setBoardUrl(null)
        setLocalVideoHidden(false)
        webcamVideoRef.current.srcObject = null
        remoteVideoRef.current.srcObject = null

        setDevicesChanged(false)
        setMicDeviceId('default')
        setCameraDeviceId('default')
        setVideoDeviceModelHidden(true)
        setAudioDeviceModelHidden(true)

        setRemoteUser({})

        endSoundMeter()

        setTimeout(initLocalStream, 100)
    }

    function isWebCamViewActive() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        return active
    }

    function isRemoteViewActive() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        return active
    }

    async function selectMicDevice(deviceId) {
        console.log("SELECTED_MIC_DEVICE_ID", deviceId)
        setMicDeviceId(deviceId)
        setAudioDeviceModelHidden(true)
        if (isLocalAudioSharing) {
            setNewAudioTrack(peerConnection, localStream, deviceId)
        }
    }

    async function selectCameraDevice(deviceId) {
        console.log("SELECTED_CAMERA_DEVICE_ID", deviceId)
        setCameraDeviceId(deviceId)
        setVideoDeviceModelHidden(true)
        if (isLocalVideoSharing) {
            setNewVideoTrack(peerConnection, localStream, 'webcam', deviceId)
        }
    }


    return (
        <>
            {
                !isCallStarted &&
                <div id="overlay"></div>
            }
            {
                !isAuthorized &&
                <div id="loader"><img alt="" src={icLoader} /></div>
            }
            {
                isAuthorized &&
                <div className="c-row ">
                    <div className="c-col-12" id="videos" >
                        <span
                            style={{
                                display: isLocalVideoSharing && !isLocalVideoHidden ? "initial" : "none",
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
                                isCallStarted && (!isRemoteVideoMute || isRemoteScreenSharingEnabled) &&
                                <button id="hideLocalVideoBtn" onClick={hideLocalVideo}>
                                    <img alt="" src={icTimes} />
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
                            isLocalScreenSharing &&
                            <div className="local-screen-sharing">
                                <img alt="" src={icScreenSharing}></img>
                            </div>
                        }
                        {
                            isLocalBoardOpen &&
                            <div className="whiteBoardContainer">
                                <button onClick={toggleBoard}>
                                    <img alt="" src={icPhoneOn}></img>
                                </button>
                                <iframe
                                    title="WhiteBoard"
                                    id="whiteBoard"
                                    src={boardUrl}
                                >
                                </iframe>
                            </div>
                        }
                        {
                            isCallStarted &&
                            <>
                                <div id="indicator-container"
                                    className={isLocalBoardOpen ? "board" : (isLocalVideoSharing || isLocalScreenSharing || !isRemoteVideoMute || isRemoteScreenSharingEnabled ? "" : "active")}
                                >
                                    <div className="btns">
                                        {
                                            Object.keys(remoteUser).length > 0 &&
                                            <>
                                                <div
                                                    className={"soundBubble"}
                                                    style={{ transform: `scale(${audioScale(remoteAudioReading)})` }}
                                                >
                                                </div>
                                                <div className="remoteUserName">
                                                    <p>
                                                        {getNameInitials(remoteUser.name)}
                                                    </p>
                                                </div>
                                            </>
                                        }
                                    </div>
                                    <div className="indicator">
                                        {
                                            isRemoteMicMute &&
                                            <div>
                                                <div>
                                                    <img alt="" src={icMicSlash}></img>
                                                </div>
                                            </div>
                                        }
                                        {
                                            isRemoteVideoMute &&
                                            <div>
                                                <div>
                                                    <img alt="" src={icVideoSlash}></img>
                                                </div>
                                            </div>
                                        }
                                        {
                                            isRemoteScreenSharingEnabled &&
                                            <div>
                                                <div>
                                                    <img alt="" src={icScreenSharing}></img>
                                                </div>
                                            </div>
                                        }
                                        {
                                            isRemoteBoardOpen &&
                                            <div>
                                                <div>
                                                    <img alt="" src={icBrush}></img>
                                                </div>
                                            </div>
                                        }
                                    </div>
                                </div>
                            </>
                        }
                    </div>
                    <div className={`call-controls-container ${isCallStarted ? 'calling' : 'not-calling'} c-col-12`}>
                        <div className="c-row">
                            <div
                                id="my-user-info"
                                className=" c-col-12 text-center"
                                style={{ display: isCallStarted ? "none" : "initial" }}
                            >
                                <div>
                                    <p>{getNameInitials(user.name)}</p>
                                </div>
                            </div>
                            <div className="c-col-12 main-call-controls">
                                {
                                    (isCalling || isCallStarted) &&
                                    <button
                                        id="hangupButton"
                                        className="operation-btn"
                                        onClick={endVideoCall}
                                    >
                                        <img alt="" src={icPhoneOff} />
                                    </button>
                                }
                                <span
                                    className="media-device-container"
                                >
                                    <button
                                        className="operation-btn"
                                        onClick={toggleMicrophone}
                                    >
                                        <img alt="" src={isLocalAudioSharing ? icMic : icMicSlash} />
                                    </button>
                                    <button
                                        className="device-selector"
                                        onClick={() => setAudioDeviceModelHidden(false)}
                                    >
                                        <img alt="" src={icMic} />
                                    </button>
                                </span>
                                <span
                                    className={isLocalVideoSharing ? "media-device-container" : "media-device-container active"}
                                >
                                    <button
                                        className="operation-btn"
                                        onClick={toggleVideo}
                                        disabled={isLocalScreenSharing}
                                    >
                                        <img alt="" src={isLocalVideoSharing ? icVideo : icVideoSlash} />
                                    </button>
                                    <button
                                        className="device-selector"
                                        onClick={() => setVideoDeviceModelHidden(false)}
                                    >
                                        <img alt="" src={icVideo} />
                                    </button>
                                </span>
                                {
                                    isCallStarted &&
                                    <>
                                        <button
                                            className="operation-btn"
                                            onClick={toggleScreenShare}
                                        >
                                            <img alt="" src={isLocalScreenSharing ? icScreenSharingSlash : icScreenSharing} />
                                        </button>
                                        {
                                            isLocalVideoHidden &&
                                            <button
                                                className="operation-btn"
                                                onClick={showLocalVideo}
                                            >
                                                <img alt="" src={icPortrait} />
                                            </button>
                                        }
                                        <button
                                            className="operation-btn"
                                            onClick={toggleBoard}
                                        >
                                            <img alt="" src={icBrush} />
                                        </button>
                                    </>
                                }
                            </div>
                            <div className="c-col-12 secondary-call-controls">
                                {
                                    !isCallStarted &&
                                    <button id="joinBtn"
                                        disabled={isCalling || !isAuthorized}
                                        onClick={startVideoCall}
                                        className={isCalling ? 'calling' : ''}
                                    >
                                        {
                                            !isCalling ? "JOIN" : (isJoined ? "WAITING FOR SOMEONE TO JOIN" : "JOINING")
                                        }
                                    </button>
                                }
                            </div>
                        </div>
                    </div>
                    <div
                        className='model'
                        style={{ display: isAudioDeviceModelHidden ? "none" : "flex" }}
                    >
                        <div className='model-body'>
                            <div className="model-header">
                                <button>
                                    <img alt="" src={icTimes} onClick={() => setAudioDeviceModelHidden(true)} />
                                </button>
                            </div>
                            <div className="model-content">
                                <div className="model-label">Select Microphone</div>
                                <Select
                                    className="select"
                                    options={getAudioMediaDevices().map(d => {
                                        return { value: d.deviceId, label: d.label }
                                    })}
                                    defaultValue={micDeviceId}
                                    onChange={(e) => selectMicDevice(e.value)}
                                />
                            </div>
                        </div>
                    </div>
                    <div
                        className='model'
                        style={{ display: isVideoDeviceModelHidden ? "none" : "flex" }}
                    >
                        <div className='model-body'>
                            <div className="model-header">
                                <button>
                                    <img alt="" src={icTimes} onClick={() => setVideoDeviceModelHidden(true)} />
                                </button>
                            </div>
                            <div className="model-content">
                                <div className="model-label">Select Camera</div>
                                <Select
                                    className="select"
                                    options={getVideoMediaDevices().map(d => {
                                        return { value: d.deviceId, label: d.label }
                                    })}
                                    onChange={(e) => selectCameraDevice(e.value)}

                                />
                            </div>
                        </div>
                    </div>

                </div>
            }

            <div className="text-center">
                <div id="snackbar"></div>
            </div>
        </>
    );

}

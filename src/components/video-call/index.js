

import React, { useEffect, useState } from 'react'

import SelectDevice from '../select-device';
import io, { Socket } from "socket.io-client"
import './style.css';
import { IOEvents } from "./events"
import { servers, IOConfig, Browsers, ScreenSharingConfig } from './config';
import { useParams } from 'react-router';
import { getWhiteboardUrl, URLs } from './urls';
import {
    getAudioMediaDevices,
    getVideoMediaDevices,
    isAudioAvailable,
    isCameraAvailable,
    removeAllAudioTracks,
    removeAllVideoTracks,
    setNewAudioTrack,
    setNewVideoTrack,
    closeStreamsAndResetVideo,
    setNewTrack
} from './stream';
import { audioScale, getNameInitials, playSound, stopSound, toast, getFirstName } from '../../utils';
import { SoundMeter } from './sound-meter'
import ApplicationSounds from '../application-sounds';
import Indicator from '../indicator';
import Whiteboard from '../whiteboard';
import VideoContainer from '../video-container';
import CallControl from '../call-control';
import SelectDeviceTrigger from '../select-device-trigger';


import Feedback from '../feedback';


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
const icConnecting = require('../../images/connecting.svg').default;
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

/**@type {Socket} */
let socket;
let soundMeter;

export const VideoCall = () => {

    const [webcamVideoRef, setWebcamVideoRef] = useState(React.createRef());
    const [remoteVideoRef, setRemoteVideoRef] = useState(React.createRef());

    const [isAuthorized, setAuthorized] = useState(false);
    const [isFirstAttempt, setFirstAttempt] = useState(true);
    const [isReconnecting, setIsReconnecting] = useState(false);

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

    const [micDeviceId, setMicDeviceId] = useState('');
    const [cameraDeviceId, setCameraDeviceId] = useState('');

    const [isAudioDeviceModelHidden, setIsAudioDeviceModelHidden] = useState(true);
    const [isVideoDeviceModelHidden, setIsVideoDeviceModelHidden] = useState(true);

    const [isLocalVideoHidden, setLocalVideoHidden] = useState(false);

    const [user, setUser] = useState({});
    const [remoteUser, setRemoteUser] = useState({});

    const [videoDevices, setVideoDevices] = useState([]);
    const [audioDevices, setAudioDevices] = useState([]);

    const [isFeedback, setIsFeedback] = useState(false);

    const [browser, setBrowser] = useState('');

    const { token, meetingId, lang } = useParams();



    const endCallCallback = (event, res) => {
        console.log(event, res)
        if (res.message) toast(res.message)
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
            if (res.success) {
                setAuthorized(true)
                setUser(res.data);
                initLocalStream();
                if (!isLocalAudioSharing) setTimeout(toggleMicrophone, 3000);
                setCallStarted(isCallStarted => {
                    if (isCallStarted) {
                        console.log("RECONNECTING");
                        socket.emit(IOEvents.RECONNECTING, { meetingId: meetingId })
                        setTimeout(() => createOffer(false), 1000);
                    }
                    return isCallStarted;
                })
            }
            else {
                setAuthorized(false)
                setUser({});
                toast("You are not authorized")
            }
        });

        socket.on(IOEvents.OFFER, async (res) => {
            console.log(IOEvents.OFFER, res);
            if (peerConnection && res.data) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                const answerDescription = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answerDescription);
                // -------------------------------------- //
                // --------------SEND ANSWER------------- //
                // -------------------------------------- //
                socket.emit(IOEvents.ANSWER, {
                    data: answerDescription
                });
            }
        })

        socket.on(IOEvents.ANSWER, async (res) => {
            console.log(IOEvents.ANSWER, res);
            if (res.user) {
                setRemoteUser(res.user)
            }

            if (res.data && peerConnection) {
                peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));    
                setCallStarted(isCallStarted => {
                    if (!isCallStarted) {       
                        socket.emit(IOEvents.START_CALL);
                    }
                    return isCallStarted;
                })
                
            }
        });

        socket.on(IOEvents.ALREADY_JOINED, res => endCallCallback(IOEvents.ALREADY_JOINED, res));
        socket.on(IOEvents.INVALID_PARTICIPANT, res => endCallCallback(IOEvents.INVALID_PARTICIPANT, res));
        socket.on(IOEvents.MEETING_NOT_FOUND, res => endCallCallback(IOEvents.MEETING_NOT_FOUND, res));
        socket.on(IOEvents.MEETING_NOT_ACTIVE, res => endCallCallback(IOEvents.MEETING_NOT_ACTIVE, res));
        socket.on(IOEvents.ROOM_NOT_FOUND, res => endCallCallback(IOEvents.ROOM_NOT_FOUND, res));

        socket.on(IOEvents.CREATE_ROOM, () => {
            startVideoCall()
        })

        socket.on(IOEvents.ROOM_EXIST, function () {
            socket.emit(IOEvents.ROOM_JOIN, {
                meetingId: meetingId,
            })
        });

        socket.on(IOEvents.CREATE_ICE_EVENT_DATA, (res) => {
            console.log(IOEvents.CREATE_ICE_EVENT_DATA, res)
            try {
                if (res.data) {
                    const candidate = new RTCIceCandidate(res.data);
                    try { peerConnection.addIceCandidate(candidate); } catch (err) { }
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
                peerConnection.setRemoteDescription(new RTCSessionDescription(res.answer));
                socket.emit(IOEvents.START_CALL);
            }
        });

        socket.on(IOEvents.ROOM_JOIN, async (res) => {
            console.log(IOEvents.ROOM_JOIN, res)
            try {
                if (res.data) {
                    await peerConnection.setRemoteDescription(new RTCSessionDescription(res.data));
                    const answerDescription = await peerConnection.createAnswer();

                    await peerConnection.setLocalDescription(answerDescription);
                    // --------------------------------------- //
                    // ---------------SEND ANSWER------------- //
                    // --------------------------------------- //
                    socket.emit(IOEvents.ANSWER_CALL, {
                        data: answerDescription
                    });
                }
            } catch (error) {
                console.log("ROOM_JOIN_ERROR", error)
                createOffer();
            }
        });

        socket.on(IOEvents.JOINED_ROOM_AS_RECEIVER, function (res) {
            console.log(IOEvents.JOINED_ROOM_AS_RECEIVER, res)
            if (res.data) {
                setRemoteUser(res.data);
                setJoined(true);
            } else {
                endVideoCall()
            }
        });

        socket.on(IOEvents.CALL_ON_WAIT, () => {
            console.log(IOEvents.CALL_ON_WAIT)
            setJoined(true)
        });

        socket.on(IOEvents.START_CALL, () => {
            console.log(IOEvents.START_CALL)
            stopSound('sound-calling');
            playSound('sound-call-started', false);
            setupIceEventOnStartCall()
            if (isCallStarted) return sendInitialEvents()
            setCallStarted(true)
        });

        socket.on(IOEvents.END_CALL, () => {
            console.log(IOEvents.END_CALL)
        });

        socket.on(IOEvents.CALL_ENDED, (res) => {
            console.log(IOEvents.CALL_ENDED, res)
            setIsFeedback(true)
            callEnded()
        });

        socket.on(IOEvents.MUTE_AUDIO, () => {
            console.log(IOEvents.MUTE_AUDIO)
            setRemoteMicMute(true)
            // Clearning Sound Meter instance if exists
            endSoundMeter();
        });

        socket.on(IOEvents.UNMUTE_AUDIO, () => {
            console.log(IOEvents.UNMUTE_AUDIO)
            setRemoteMicMute(false);
            // Clearning Sound Meter instance if exists
            endSoundMeter();
            // starting new sound meter instance if audio is unmuted
            if (!isRemoteMicMute) startSoundMeter()
        });

        socket.on(IOEvents.MUTE_VIDEO, () => {
            console.log(IOEvents.MUTE_VIDEO)
            setRemoteVideoMute(true)
        });

        socket.on(IOEvents.UNMUTE_VIDEO, () => {
            console.log(IOEvents.UNMUTE_VIDEO)
            setRemoteVideoMute(false)
        });

        socket.on(IOEvents.SCREEN_SHARING_ENABLED, () => {
            console.log(IOEvents.SCREEN_SHARING_ENABLED)
            setRemoteScreenSharingEnabled(true)
        });

        socket.on(IOEvents.SCREEN_SHARING_DISABLED, () => {
            console.log(IOEvents.SCREEN_SHARING_DISABLED)
            setRemoteScreenSharingEnabled(false)
        });

        socket.on(IOEvents.OPEN_BOARD, () => {
            console.log(IOEvents.OPEN_BOARD)
            setRemoteBoardOpen(true)
        });

        socket.on(IOEvents.CLOSE_BOARD, () => {
            console.log(IOEvents.CLOSE_BOARD)
            setRemoteBoardOpen(false)
        });
    }

    function endCallOnReload() {
        console.log("Page Reloading")
        socket.emit(IOEvents.END_CALL)
        window.removeEventListener("beforeunload", endCallOnReload);
    }

    async function createOffer(newConnection = true) {
        try {
            if (peerConnection) {
                console.log(`CREATING OFFER | newConnection: ${newConnection}`);
                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);
                console.log(`EMITTING: ${IOEvents.OFFER}`)
                socket.emit(IOEvents.OFFER, { data: offer });
            }
        } catch (error) {
            console.log("CREATING_RE-NEGOTIATION_OFFER_ERROR", error)
        }

    }

    async function init() {
        initSocket()
        updateDevices()
        navigator.mediaDevices.addEventListener('devicechange', updateDevices)
        window.addEventListener("beforeunload", endCallOnReload)
        initLocalStream()
    }

    function initPeerConnection() {
        try {
            // Global State
            peerConnection = new RTCPeerConnection(servers);
            remoteStream = new MediaStream();

            candidates = [];

            peerConnection.addEventListener('icecandidate', event => {
                if (event.candidate) {
                    candidates.push(event.candidate)
                }
            });

            // Push tracks from local stream to peer connection
            localStream.getTracks().forEach((track) => {
                peerConnection.addTrack(track, localStream);
            });

            peerConnection.onnegotiationneeded = () => createOffer(false);
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
        candidates.forEach(c => {
            socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                data: c
            });
        });

        peerConnection.addEventListener('icecandidate', event => {
            if (event.candidate) {
                socket.emit(IOEvents.CREATE_ICE_EVENT_DATA, {
                    data: event.candidate
                });
            }
        });

        peerConnection.addEventListener("iceconnectionstatechange", event => {

            const state = peerConnection.iceConnectionState;
            console.log(`PeerConnection status: ${state}`);

            if (peerConnection) setIsReconnecting(!(state == 'connected' || state == 'completed'));

            if (state === "failed" || state == 'disconnected') {
                peerConnection.restartIce();
                createOffer(false);
            }
        });
    }

    function closeConnection() {
        closeStreamsAndResetVideo(peerConnection, remoteStream, remoteVideoRef, 'remote');
        closeStreamsAndResetVideo(peerConnection, localStream, webcamVideoRef, 'local');
        peerConnection = null
    }

    async function initLocalStream() {
        try {
            setTimeout(() => {
                if (!localStream && webcamVideoRef && webcamVideoRef.current) {
                    localStream = new MediaStream();
                    webcamVideoRef.current.srcObject = localStream
                }
            }, 500);

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
                    meetingId: meetingId,
                    data: offerDescription
                });
            } catch (error) {
                console.log("CREATE_ROOM_FUNCTION_ERROR", error)
            }
        }, 1000);
    }

    function sendInitialEvents() {
        if (socket && isCallStarted) {
            socket.emit(isLocalAudioSharing ? IOEvents.UNMUTE_AUDIO : IOEvents.MUTE_AUDIO)
            socket.emit(isLocalVideoSharing ? IOEvents.UNMUTE_VIDEO : IOEvents.MUTE_VIDEO)
        }
    }

    async function toggleMicrophone() {

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
            toast("Microphone is not enabled")
        }
    }

    async function toggleVideo() {
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
                let stream = await navigator.mediaDevices.getDisplayMedia(ScreenSharingConfig)

                let track = stream.getVideoTracks()[0].clone();
                stream.getTracks().forEach(t => { t.stop(); stream.removeTrack(t) });
                track.onended = toggleScreenShare;
                setNewTrack(peerConnection, localStream, track)

                webcamVideoRef.current.srcObject = localStream
            }

            isLocalScreenSharingFlag = !isLocalScreenSharingFlag
            socket.emit(isLocalScreenSharingFlag ? IOEvents.SCREEN_SHARING_ENABLED : IOEvents.SCREEN_SHARING_DISABLED)
            setLocalScreenSharing(isLocalScreenSharingFlag)

        } catch (error) {
            console.log("Screen Toggle Safari Error", error)
        }
    }

    async function startVideoCall() {
        setCalling(true)
        playSound('sound-calling', true);
        initPeerConnection()
        setTimeout(createRoom, 1000);
    }

    function endVideoCall() {
        callEnded()
        socket.emit(IOEvents.END_CALL);

    }

    const callEnded = () => {
        stopSound('sound-calling');
        playSound('sound-call-ended', false)
        closeConnection()
        if (isCallStarted && !isFeedback) setIsFeedback(true)
        resetAllStates()
    }

    function resetAllStates() {
        setFirstAttempt(true)
        setIsReconnecting(false)
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

        setMicDeviceId('default')
        setCameraDeviceId('default')
        setIsVideoDeviceModelHidden(true)
        setIsAudioDeviceModelHidden(true)

        setRemoteUser({})
        setTimeout(initLocalStream, 100)
    }

    function isVideoInNormalState() {
        let active = false
        if (isCallStarted) active = true
        if (isRemoteVideoMute) active = false
        if (isRemoteScreenSharingEnabled) active = true
        return active
    }

    async function selectMicDevice(deviceId) {
        // console.log("SELECTED_MIC_DEVICE_ID", deviceId)
        setMicDeviceId(deviceId)
        setIsAudioDeviceModelHidden(true)
        if (isLocalAudioSharing) {
            setNewAudioTrack(peerConnection, localStream, deviceId)
        }
    }

    async function selectCameraDevice(deviceId) {
        setCameraDeviceId(deviceId)
        setIsVideoDeviceModelHidden(true)
        if (isLocalVideoSharing) {
            setNewVideoTrack(peerConnection, localStream, 'webcam', deviceId)
        }
    }

    async function updateDevices() {
        if (await isCameraAvailable()) {
            let devices = await getVideoMediaDevices();
            setVideoDevices(devices);
            if (!cameraDeviceId && devices.length > 0) {
                setCameraDeviceId(devices[0].deviceId);
            }
        }

        if (await isAudioAvailable()) {
            let devices = await getAudioMediaDevices();
            setAudioDevices(devices);
            if (!micDeviceId && devices.length > 0) {
                setMicDeviceId(devices[0].deviceId);
            }
        }
    }

    useEffect(init, []);

    function detectBrowser() {

        if ((navigator.userAgent.indexOf("Opera") || navigator.userAgent.indexOf('OPR')) != -1) {
            setBrowser(Browsers.Opera)
        }
        else if (navigator.userAgent.indexOf("Chrome") != -1) {
            setBrowser(Browsers.Chrome)
        }
        else if (navigator.userAgent.indexOf("Safari") != -1) {
            setBrowser(Browsers.Safari)
        }
        else if (navigator.userAgent.indexOf("Firefox") != -1) {
            setBrowser(Browsers.Firefox)
        }
        else if ((navigator.userAgent.indexOf("MSIE") != -1) || (!!document.documentMode == true)) //IF IE > 10
        {
            setBrowser(Browsers.MSIE)
        }
        else {
            setBrowser('')
        }
    }

    useEffect(() => {
        detectBrowser()
    }, [])

    useEffect(sendInitialEvents, [isCallStarted])

    useEffect(updateDevices, [isLocalAudioSharing, isLocalVideoSharing])

    useEffect(() => {
        if (isLocalVideoSharing && !videoDevices.find(m => m.deviceId === cameraDeviceId)) {
            toggleVideo();
        }
    }, [cameraDeviceId])

    useEffect(() => {
        if (isLocalAudioSharing && !audioDevices.find(m => m.deviceId === micDeviceId)) {
            toggleMicrophone();
        }
    }, [micDeviceId])

    function startSoundMeter() {
        console.log("starting sound meter");
        var AudioContext = window.AudioContext // Default
            || window.webkitAudioContext // Safari and old versions of Chrome
            || false;

        if (AudioContext) {
            let ctx = new AudioContext;
            setCallStarted(isCallStarted => {
                if (isCallStarted) {
                    if (remoteStream.getAudioTracks().length > 0) {
                        soundMeter = new SoundMeter(
                            ctx,
                            instant => setRemoteAudioReading(instant)
                        );
                        soundMeter.connectToSource(remoteStream);
                    }
                }
                return isCallStarted;
            })
        } else {
            console.warning("AudioContext is not supported. Sound bubble will not work")
        }



    }

    function endSoundMeter() {
        if (soundMeter) {
            soundMeter.stop();
            soundMeter = null;
        }
        setRemoteAudioReading(0)
    }

    return (
        <>
            {
                !isCallStarted &&
                <div id="overlay"></div>
            }

            <div style={{ display: !isReconnecting ? 'none' : 'unset' }} id="reconnection"><img alt="" src={icConnecting} /></div>

            {
                !isAuthorized &&
                <div id="loader"><img className="rotate" alt="" src={icLoader} /></div>
            }

            {
                isAuthorized &&
                <div className="c-row ">
                    <div className="c-col-12" id="videos" >
                        <span
                            style={{
                                display:  (isLocalVideoSharing || isLocalScreenSharing) && !isLocalVideoHidden ? "initial" : "none",
                            }}
                        >
                            <VideoContainer
                                containerId="webcamVideo"
                                reference={webcamVideoRef}
                                isMuted={true}
                                isActive={isVideoInNormalState()} />
                            {
                                isCallStarted && (!isRemoteVideoMute || isRemoteScreenSharingEnabled) &&
                                <button id="hideLocalVideoBtn" onClick={() => setLocalVideoHidden(true)}>
                                    <img alt="" src={icTimes} />
                                </button>
                            }
                        </span>
                        <span>
                            <VideoContainer
                                containerId="remoteVideo"
                                reference={remoteVideoRef}
                                isMuted={false}
                                isActive={isVideoInNormalState()} />
                        </span>

                        <Whiteboard
                            visible={isLocalBoardOpen}
                            url={boardUrl}
                            onBack={toggleBoard}
                            backIcon={icPhoneOn}
                            isAudioEnabled={isLocalAudioSharing}
                            isVideoEnabled={isLocalVideoSharing}
                            onAudioToggle={toggleMicrophone}
                            onVideoToggle={toggleVideo}
                        />

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
                                                    <img src={`${URLs.rootApi}/public${remoteUser.profilePicture ?? '/profile-pictures/default.png'}`} />
                                                </div>
                                            </>
                                        }
                                    </div>
                                    <div className="indicator">
                                        <Indicator visible={isRemoteMicMute} icon={icMicSlash} />
                                        <Indicator visible={isRemoteVideoMute} icon={icVideoSlash} />
                                        <Indicator visible={isRemoteScreenSharingEnabled} icon={icScreenSharing} />
                                        <Indicator visible={isRemoteBoardOpen} icon={icBrush} />
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
                                    <img src={`${URLs.rootApi}/public${user.profilePicture?? '/profile-pictures/default.png'}`} />
                                    <p>{getFirstName(user.name)}</p>
                                </div>
                            </div>
                            <div className="c-col-12 main-call-controls">
                                <CallControl
                                    id="hangupButton"
                                    visible={isCalling || isCallStarted}
                                    onClick={endVideoCall}
                                    icon={icPhoneOff}
                                />
                                <span
                                    className="media-device-container"
                                >
                                    <CallControl
                                        visible={true}
                                        onClick={toggleMicrophone}
                                        icon={isLocalAudioSharing ? icMic : icMicSlash}
                                    >
                                        <SelectDeviceTrigger
                                            visible={audioDevices.length > 0}
                                            onClick={() => setIsAudioDeviceModelHidden(false)}
                                        />
                                    </CallControl>
                                </span>
                                <span
                                    className={isLocalVideoSharing ? "media-device-container" : "media-device-container active"}
                                >
                                    <CallControl
                                        visible={true}
                                        disabled={isLocalScreenSharing}
                                        onClick={toggleVideo}
                                        icon={isLocalVideoSharing ? icVideo : icVideoSlash}
                                    >
                                        <SelectDeviceTrigger
                                            visible={videoDevices.length > 0}
                                            onClick={() => setIsVideoDeviceModelHidden(false)}
                                        />
                                    </CallControl>
                                </span>
                                {
                                    isCallStarted &&
                                    <>
                                        <CallControl
                                            className='screen-share-btn'
                                            visible={true}
                                            onClick={toggleScreenShare}
                                            icon={isLocalScreenSharing ? icScreenSharingSlash : icScreenSharing}
                                        />

                                        <CallControl
                                            visible={isLocalVideoHidden}
                                            onClick={() => setLocalVideoHidden(false)}
                                            icon={icPortrait}
                                        />

                                        <CallControl
                                            visible={true}
                                            onClick={toggleBoard}
                                            icon={icBrush}
                                        />

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
                    <SelectDevice
                        visible={!isAudioDeviceModelHidden}
                        devices={audioDevices}
                        title={"Select Microphone"}
                        placeholder="Select a Microphone"
                        selectedDevicesId={micDeviceId}
                        onSelectDevice={selectMicDevice}
                        onClose={() => setIsAudioDeviceModelHidden(true)}
                    />

                    <SelectDevice
                        visible={!isVideoDeviceModelHidden}
                        devices={videoDevices}
                        title={"Select Camera"}
                        placeholder="Select a camera devices"
                        selectedDevicesId={cameraDeviceId}
                        onSelectDevice={selectCameraDevice}
                        onClose={() => setIsVideoDeviceModelHidden(true)}
                    />
                </div>
            }

            <div className="text-center">
                <div id="snackbar"></div>
            </div>

            <ApplicationSounds />

            <Feedback
                meetingId={meetingId}
                userType={user.roleId}
                token={token}
                isFeedback={isFeedback}
                onClose={() => setIsFeedback(false)}
            />
        </>
    );

}
